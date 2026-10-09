import test from 'node:test';
import assert from 'node:assert/strict';
import {harness,sample,TEAM,USER,HR} from './helpers/slack.js';
import * as v from '../src/views.js';
const nav=view=>view.blocks.find(b=>b.block_id?.startsWith('nav_')).block_id;
const pageAnswers=(view,choice='yes')=>Object.fromEntries(view.blocks.filter(b=>b.block_id?.match(/^q\d+_\d+$/)).map(b=>[b.block_id,choice]));

test('real Bolt dispatch: command, Home events, new, private history and refresh',async t=>{
 const h=harness(t);await h.command();assert.equal(h.view.callback_id,'pick');await h.event();assert.equal(h.count('views.publish'),1);await h.event(USER,'messages');assert.equal(h.count('views.publish'),1);
 await h.action('new','new',{view:{type:'home'}});assert.equal(h.view.callback_id,'pick');
 for(let i=0;i<31;i++)h.seed({...sample(),id:'check'+i});
 await h.action('my_history','my_history',{view:{type:'home'}});assert.equal(h.view.callback_id,'history');assert.ok(JSON.stringify(h.view).includes('31 total checks'));
 await h.action('history_page','1');assert.equal(h.view.callback_id,'history');
 await h.action('history_page_nav1','999');assert.ok(h.view.blocks.length<30);
 await h.action('open','check0');assert.equal(h.view.callback_id,'result');
});

test('Home refreshes immediately and clear history requires confirmation',async t=>{
 const h=harness(t);h.seed();h.seed({...sample(),id:'check2'});const before=h.count('views.publish');await h.action('refresh_home','refresh_home',{view:{type:'home'}});assert.equal(h.count('views.publish'),before+1);
 await h.action('clear_history','clear_history',{view:{type:'home'}});assert.equal(h.view.callback_id,'clear_history_confirm');assert.equal(h.store.list('check',TEAM+':'+USER).length,2);
 await h.submit();assert.equal(h.store.list('check',TEAM+':'+USER).length,0);assert.equal(h.store.listAudit(TEAM)[0].action,'history.cleared');assert.equal(h.calls.at(-1).method,'views.publish');
});

test('all 10 scenarios: pick, contexts, partial save/resume, back, completion, edit and rerun',async t=>{
 const h=harness(t);await h.command();await h.submit({scenarios:v.names,employee:'Test Employee'});
 const id=JSON.parse(h.view.private_metadata).id;
 for(let i=0;i<10;i++)await h.submit();assert.equal(h.view.callback_id,'answers');
 const firstNav=nav(h.view),q0=h.view.blocks.find(b=>b.block_id?.startsWith('q0_')).block_id,n0=h.view.blocks.find(b=>b.block_id?.startsWith('n0_')).block_id;await h.submit({[q0]:'yes',[n0]:'Draft note',[firstNav]:'save'});assert.equal(h.acks.at(-1).response_action,'clear');
 assert.equal(h.store.get(id,TEAM+':'+USER,'check').answers[1],null);
 await h.action('open',id,{view:{type:'home'}});assert.equal(h.view.blocks.find(b=>b.block_id?.startsWith('n0_')).element.initial_value,'Draft note');
 let error=await h.submit({[nav(h.view)]:'next'});assert.equal(error.response_action,'errors');assert.ok(Object.keys(error.errors).some(k=>k.startsWith('q1_')));
 await h.submit({...pageAnswers(h.view),[nav(h.view)]:'next'});const secondNav=nav(h.view);assert.notEqual(firstNav,secondNav);
 await h.submit({[secondNav]:'back'});assert.notEqual(nav(h.view),firstNav);assert.equal(h.view.blocks.find(b=>b.block_id===nav(h.view)).element.initial_option.value,'next');
 for(let i=0;i<10;i++)await h.submit({...pageAnswers(h.view),[nav(h.view)]:'next'});
 assert.equal(h.view.callback_id,'result');let r=h.store.get(id,TEAM+':'+USER,'check');assert.equal(r.stage,'done');assert.equal(r.answers.length,50);
 await h.action('result_page_9',JSON.stringify({id,page:9,hr:false}));assert.ok(JSON.stringify(h.view).includes('Leave of Absence'));
 await h.action('edit',id);assert.equal(h.view.callback_id,'answers');await h.action('rerun',id);assert.equal(h.view.callback_id,'context');assert.equal(h.store.list('check',TEAM+':'+USER).length,2);
});

test('supporting links and follow-up are validated, saved, visible, and dismissible',async t=>{
 const h=harness(t);const r=h.seed();await h.action('open',r.id);await h.action('attachments',r.id);
 await h.submit({links:'https://example.com/evidence\nDetails',files:[{id:'F1',name:'evidence.pdf',title:'Evidence',mimetype:'application/pdf',permalink:'https://slack.test/F1'}]});assert.ok(JSON.stringify(h.view).includes('https://example.com/evidence'));assert.equal(h.store.get(r.id).evidenceFiles[0].name,'evidence.pdf');
 await h.action('followup',r.id);let result=await h.submit({date:'2026-02-30'});assert.ok(result.errors.date);
 await h.submit({date:'2026-10-15'});assert.equal(h.store.get(r.id).followup,'2026-10-15');
 await h.action('open',r.id,{view:{type:'home'}});await h.action('followup',r.id);await h.submit({date:''});assert.equal(h.store.get(r.id).followup,'');
});

test('clear controls reset questionnaire and evidence forms before explicit submission',async t=>{
 const h=harness(t);const r=h.seed({...sample(),stage:'questions',answers:Array(5).fill('yes'),notes:Array(5).fill('Saved note'),attachments:'Saved context'});
 await h.action('open',r.id,{view:{type:'home'}});assert.equal(h.view.submit.text,'Submit answers');await h.action('clear_answers',r.id);const cleared=h.store.get(r.id);assert.ok(cleared.answers.every(x=>x===null));assert.ok(cleared.notes.every(x=>x===''));
 await h.action('attachments',r.id);await h.action('clear_evidence_form',r.id);assert.equal(h.view.submit.text,'Save documentation');assert.equal(h.view.blocks.find(b=>b.block_id==='links').element.initial_value,undefined);assert.equal(h.store.get(r.id).attachments,'Saved context');
});

test('Word report uses real docx generation and private DM; API failure becomes visible',async t=>{
 const h=harness(t);const r=h.seed();await h.action('open',r.id);await h.action('export',r.id);
 assert.equal(h.count('files.uploadV2'),1);assert.equal(h.calls.find(c=>c.method==='conversations.open').arg.users,USER);assert.ok(JSON.stringify(h.view).includes('was sent'));
 h.fail['files.uploadV2']={data:{error:'missing_scope'}};await h.action('open',r.id);await h.action('export',r.id);assert.ok(JSON.stringify(h.view).includes('permissions are missing'));
});

test('HR snapshot, partial delivery failure, retry, duplicate submission and review protection',async t=>{
 const h=harness(t);const r=h.seed({...sample(v.names.slice(0,2)),attachments:'Supporting evidence'});
 await h.action('open',r.id);await h.action('share',r.id);const confirmation=structuredClone(h.view);
 h.fail['chat.postMessage']={data:{error:'ratelimited'}};await h.submit();
 let s=h.store.list('submission',TEAM)[0];assert.equal(s.delivery[USER].status,'sent');assert.equal(s.delivery[HR].status,'failed');assert.ok(JSON.stringify(h.view).includes('failed'));
 await h.action('inbox','inbox',{user:HR,view:{type:'home'}});await h.action('review',s.id,{user:HR});assert.ok(JSON.stringify(h.view).includes('Supporting evidence'));
 await h.action('result_page_1',JSON.stringify({id:s.id,page:1,hr:true}),{user:HR});
 delete h.fail['chat.postMessage'];
 await h.submit({status:'Closed',reviewNote:'Reviewed',hrFiles:[{id:'FHR1',name:'hr-memo.docx',title:'HR memo',mimetype:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',permalink:'https://slack.test/FHR1'}]},HR);s=h.store.get(s.id);assert.equal(s.reviewStatus,'Closed');assert.equal(s.hrEvidenceFiles[0].name,'hr-memo.docx');
 assert.ok(h.calls.some(c=>c.method==='chat.postMessage'&&JSON.stringify(c.arg).includes('HR review update')));assert.ok(h.store.listAudit(TEAM).some(e=>e.action==='review.notification.sent'));
 const uploads=h.count('files.uploadV2');await h.submit({},USER,confirmation);
 s=h.store.get(s.id);assert.equal(s.reviewStatus,'Closed');assert.equal(s.reviewNote,'Reviewed');assert.equal(s.delivery[HR].status,'sent');assert.equal(h.count('files.uploadV2'),uploads);
 await h.action('retry_delivery',s.id);assert.equal(h.count('files.uploadV2'),uploads);
 await h.action('delivery_status',s.id);await h.action('submission_status',r.id);assert.ok(JSON.stringify(h.view).includes('Delivered'));
 await h.action('inbox_page','999',{user:HR});assert.equal(h.view.callback_id,'inbox');
});

test('HR notes are not clobbered when another reviewer saves; supporting snapshots remain after owner deletion',async t=>{
 const h=harness(t,{hrs:[HR,'UHR2']});const r=h.seed();await h.action('open',r.id);await h.action('share',r.id);await h.submit();
 const s=h.store.list('submission',TEAM)[0];await h.action('review',s.id,{user:HR});const stale=structuredClone(h.view);
 await h.submit({status:'Closed',reviewNote:'First reviewer'},HR);
 await h.submit({status:'New',reviewNote:'Stale'},'UHR2',stale);assert.ok(JSON.stringify(h.view).includes('record changed'));assert.equal(h.store.get(s.id).reviewNote,'First reviewer');
 await h.action('open',r.id);await h.action('delete_check',r.id);await h.submit();assert.throws(()=>h.store.get(r.id));assert.equal(h.store.get(s.id).reviewStatus,'Closed');
});

test('policies open from Home, push from questions, validate fields, edit/read/delete, and paginate',async t=>{
 const h=harness(t);await h.action('policies','policies',{view:{type:'home'}});assert.equal(h.count('views.open'),1);assert.equal(h.count('views.push'),0);assert.ok(!JSON.stringify(h.view).includes('Edit'));
 await h.action('add_policy','add_policy',{user:HR,view:{type:'home'}});let res=await h.submit({name:'',content:'',category:'bad'},HR);assert.ok(res.errors.name&&res.errors.content&&res.errors.category);
 await h.submit({name:'Policy',content:'https://example.com/policy',category:'performance'},HR);const p=h.store.list('policy',TEAM)[0];
 await h.action('read_policy',p.id);assert.ok(JSON.stringify(h.view).includes('example.com/policy'));
 await h.action('edit_policy',p.id,{user:HR});await h.submit({name:'Updated',content:'Revised text',category:'conduct'},HR);assert.equal(h.store.get(p.id).name,'Updated');
 const r=h.seed({...sample(),stage:'questions'});await h.action('open',r.id,{view:{type:'home'}});await h.action('policies');assert.equal(h.count('views.push'),1);
 for(let i=0;i<22;i++)h.store.save('policy',TEAM,{name:'P'+i,category:'handbook',content:'Text'});
 await h.action('policy_page','1');await h.action('policy_page_nav1','2');assert.equal(h.view.callback_id,'policy_list');
 await h.action('delete_policy',p.id,{user:HR});await h.submit({},HR);assert.throws(()=>h.store.get(p.id));assert.equal(h.view.callback_id,'policy_list');
});

test('typed ownership and HR guards reject forged actions, callbacks and other workspaces',async t=>{
 const h=harness(t);h.seed();const s=h.store.save('submission',TEAM,{...sample(),id:'private-hr',submittedBy:USER,reviewStatus:'New'});
 await h.action('open','check1',{user:'UOTHER'});assert.ok(JSON.stringify(h.view).includes('unavailable'));
 await h.action('read_policy',s.id);assert.ok(JSON.stringify(h.view).includes('unavailable'));
 for(const id of ['add_policy','inbox','governance','review','edit_policy','delete_policy']){await h.action(id,s.id);assert.ok(JSON.stringify(h.view).includes('HR access required'));}
 await h.submit({status:'Closed'},USER,{...v.result(s,0,true),id:'V1'});assert.ok(JSON.stringify(h.view).includes('HR access required'));assert.equal(h.store.get(s.id).reviewStatus,'New');
 const count=h.calls.length;await h.action('new','new',{team:'TOTHER'});assert.equal(h.calls.length,count);
 await h.action('delivery_status',s.id,{user:'UOTHER'});assert.ok(JSON.stringify(h.view).includes('unavailable'));
});

test('HR governance center shows controls and immutable audit activity',async t=>{
 const h=harness(t);const r=h.seed();await h.action('open',r.id);await h.action('share',r.id);await h.submit();
 await h.action('governance','governance',{user:HR,view:{type:'home'}});assert.equal(h.view.callback_id,'governance');assert.ok(JSON.stringify(h.view).includes('Governance Center'));assert.ok(JSON.stringify(h.view).includes('submission.created'));
 await h.action('governance','governance',{user:HR});assert.equal(h.view.callback_id,'governance');
});

test('stale answer and attachment forms reject writes and missing records get a clean response',async t=>{
 const h=harness(t);const r=h.seed({...sample(),stage:'questions'});await h.action('open',r.id);const stale=structuredClone(h.view);
 await h.submit({...pageAnswers(h.view),[nav(h.view)]:'next'});await h.submit({...pageAnswers(stale),[nav(stale)]:'next'},USER,stale);assert.ok(JSON.stringify(h.view).includes('check changed'));
 await h.action('attachments',r.id);const form=structuredClone(h.view);h.store.save('check',TEAM+':'+USER,{...h.store.get(r.id),revision:99});await h.submit({links:'stale'},USER,form);assert.ok(JSON.stringify(h.view).includes('check changed'));
 await h.action('open','deleted');assert.ok(JSON.stringify(h.view).includes('unavailable'));
});

test('database failure acknowledges submission; API failures show recoverable UI',async t=>{
 const h=harness(t);await h.command();const original=h.store.save.bind(h.store);h.store.save=()=>{throw Error('sensitive database internals');};await h.submit({scenarios:[v.names[0]],employee:'Test'});assert.equal(h.view.callback_id,'notice');assert.ok(!JSON.stringify(h.view).includes('sensitive'));h.store.save=original;
 h.fail['views.publish']=Error('network');await h.event();assert.ok(h.logs.length);assert.ok(h.logs.every(x=>!x.includes('sensitive')));
});
