import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../src/store.js';
import {assessment,RISK_ON_YES} from '../src/scoring.js';
import {computeScore,QS} from '../src/content.js';
import {readConfig,verifyWorkspace} from '../src/config.js';
import {harness,sample,TEAM,USER,HR,state} from './helpers/slack.js';
import * as v from '../src/views.js';
import {validatePayload} from '../src/validate.js';

test('all six risk-on-Yes questions: No reduces risk; Yes and unknown raise risk; raw counts preserved',()=>{
 for(const [name,indexes] of Object.entries(RISK_ON_YES)){
  for(const index of indexes){const r=sample([name]);for(const k of indexes)r.answers[k]='no';if(!QS[name][index].critical)r.answers[2]='no';assert.equal(assessment(r).level,'good');r.answers[index]='yes';assert.notEqual(assessment(r).level,'good');if(QS[name][index].critical)assert.equal(assessment(r).level,'risk');assert.equal(assessment(r).yes,r.answers.filter(a=>a==='yes').length);r.answers[index]='unknown';assert.notEqual(assessment(r).level,'good');}
 }
 const old={...sample(),scoringVersion:undefined};assert.deepEqual(assessment(old),computeScore(QS[old.scenarios[0]],old.answers));assert.ok(v.report(old).includes('Legacy assessment'));
});
test('file-backed restart preserves checks, policy revisions, HR reviews and delivery state with private permissions',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pac-test-'));const path=join(dir,'pac.sqlite');let s;
 try{s=new Store(path);s.save('check','T:U',sample());s.save('policy','T',{id:'p',name:'Policy',revision:2});s.save('submission','T',{id:'s',reviewNote:'Reviewed',reviewStatus:'Closed',delivery:{U:{status:'failed'}}});s.close();s=new Store(path);assert.equal(s.get('check1','T:U','check').employee,'Synthetic Employee');assert.equal(s.get('s','T','submission').delivery.U.status,'failed');assert.equal(s.get('p','T','policy').revision,2);assert.equal(statSync(path).mode&0o777,0o600);assert.throws(()=>s.save('policy','T',{id:'s'}));assert.throws(()=>s.get('s','T','policy'));}finally{s?.close();rmSync(dir,{recursive:true,force:true});}
});
test('governance audit is append-only and retention removes expired governed records',()=>{
 const store=new Store(':memory:'),old='2020-01-01T00:00:00.000Z';
 try{
  const check=store.save('check',TEAM+':'+USER,{id:'old-check',createdAt:old,updatedAt:old});
  store.db.prepare('UPDATE records SET data=? WHERE id=?').run(JSON.stringify({...check,createdAt:old,updatedAt:old}),'old-check');
  store.audit({team:TEAM,actor:HR,action:'review.updated',targetKind:'submission',targetId:'S1',details:{status:'Closed'}});
  assert.equal(store.listAudit(TEAM)[0].details.status,'Closed');
  assert.equal(store.purgeExpired(365,new Date('2026-09-29T00:00:00.000Z')),1);assert.throws(()=>store.get('old-check'));
 }finally{store.close();}
});
test('configuration rejects missing/invalid/empty HR lists and invalid retention; startup rejects token/workspace mismatch',async()=>{
 const env={SLACK_BOT_TOKEN:'xoxb-test',SLACK_APP_TOKEN:'xapp-test',SLACK_TEAM_ID:TEAM,HR_USER_IDS:HR};assert.equal(readConfig(env).team,TEAM);
 for(const key of Object.keys(env))assert.throws(()=>readConfig({...env,[key]:''}));assert.throws(()=>readConfig({...env,HR_USER_IDS:', ,'}));assert.throws(()=>readConfig({...env,SLACK_TEAM_ID:'bad'}));assert.throws(()=>readConfig({...env,HR_USER_IDS:'invalid'}));assert.throws(()=>readConfig({...env,RETENTION_DAYS:'-1'}));assert.equal(readConfig({...env,RETENTION_DAYS:'365'}).retentionDays,365);
 await assert.rejects(verifyWorkspace({auth:{test:async()=>({team_id:'TOTHER',bot_id:'B'})}},TEAM));await verifyWorkspace({auth:{test:async()=>({team_id:TEAM,bot_id:'B'})}},TEAM);
});
test('every generated interactive control routes to exactly one actual Bolt registration',t=>{
 const h=harness(t),r=sample(v.names),p={id:'p',name:'Policy',content:'Content',category:'performance'},s={...r,id:'s',submittedBy:USER,reviewStatus:'New',delivery:{[USER]:{status:'failed'}}};
 const views=[v.picker(),v.wizard({...r,stage:'context'}),v.wizard({...r,stage:'questions'},[p]),v.result(r),v.result(s,0,true),v.home(Array(40).fill(r),[p],true,1),v.policyList(Array(25).fill(p),true,1),v.policyForm(p),v.policyRead(p),v.supportingForm(r),v.followupForm(r),v.shareForm(r,[HR]),v.deleteForm(r.id,'check'),v.deleteForm(p.id,'policy'),v.clearHistoryForm(3),v.inbox(Array(40).fill(s),1),v.governanceCenter({audits:[],reviewers:1,retentionDays:365}),v.deliveryView(s),v.hrMessage(s),v.notice('Error')];
 const match=(pattern,id)=>typeof pattern==='string'?pattern===id:pattern.test(id);
 for(const view of views){validatePayload(view);if(view.submit)assert.equal(h.registrations.view.filter(x=>match(x,view.callback_id)).length,1,view.callback_id);for(const b of view.blocks.filter(b=>b.type==='actions'))for(const e of b.elements)assert.equal(h.registrations.action.filter(x=>match(x,e.action_id)).length,1,e.action_id);for(const b of view.blocks.filter(b=>b.type==='input'))assert.ok(!b.dispatch_action,'inputs submit through modal, not unregistered value action');}
});
test('maximum content and hundreds of policies stay within Block Kit limits',()=>{
 const r={...sample(v.names),notes:Array(50).fill('X'.repeat(1500)),attachments:'Z'.repeat(3000)};const policies=Array.from({length:500},(_,i)=>({id:'p'+i,name:'N'.repeat(150),content:'P'.repeat(3000),category:'performance'}));
 for(let i=0;i<10;i++){validatePayload(v.result(r,i));validatePayload(v.result({...r,submittedBy:USER,reviewNote:'R'.repeat(1500)},i,true));validatePayload(v.wizard({...r,page:i,stage:'questions'},policies));}
 validatePayload(v.policyRead(policies[0]));validatePayload(v.deliveryView({id:'s',delivery:Object.fromEntries(Array.from({length:21},(_,i)=>['U'+i,{status:'failed',error:'E'.repeat(250)}]))}));
});
test('review paging preserves edited inputs without bypassing optimistic revision checks',async t=>{
 const h=harness(t),s=h.store.save('submission',TEAM,{...sample(v.names.slice(0,2)),id:'s',submittedBy:USER,reviewStatus:'New',reviewRevision:0});
 await h.action('review',s.id,{user:HR});const edited={...h.view,state:state(h.view,{status:'In review',reviewNote:'Unsaved note'})};
 await h.action('result_page_1',JSON.stringify({id:s.id,page:1,hr:true}),{user:HR,view:edited});await h.submit({},HR);assert.equal(h.store.get(s.id).reviewNote,'Unsaved note');assert.equal(h.store.get(s.id).reviewStatus,'In review');
});
test('double-click delivery retry only executes one in-flight request and retains concurrent HR notes',async t=>{
 const h=harness(t),s=h.store.save('submission',TEAM,{...sample(),id:'s',submittedBy:USER,reviewStatus:'New',delivery:{[USER]:{status:'failed',report:true}}});
 let release,started;const gate=new Promise(resolve=>release=resolve),entered=new Promise(resolve=>started=resolve);let sends=0;
 h.app.client.files.uploadV2=async()=>{sends++;started();await gate;return {ok:true};};
 // Dispatch directly: two overlapping requests have independent ack counters.
 const body={type:'block_actions',team:{id:TEAM},user:{id:USER},trigger_id:'t',view:{...v.deliveryView(s),id:'V1',hash:'h'},actions:[{type:'button',action_id:'retry_delivery',value:s.id}]};
 let acks=0;const first=h.app.processEvent({body,ack:async()=>{acks++;}});await entered;
 await h.app.processEvent({body,ack:async()=>{acks++;}});h.store.save('submission',TEAM,{...h.store.get(s.id),reviewStatus:'Closed',reviewNote:'Concurrent HR review'});release();await first;
 assert.equal(sends,1);assert.equal(acks,2);assert.equal(h.store.get(s.id).reviewNote,'Concurrent HR review');assert.equal(h.store.get(s.id).delivery[USER].status,'sent');
});

test('startup environment, manifest and registered triggers agree exactly',async t=>{
 const {readFileSync}=await import('node:fs');const h=harness(t);const m=JSON.parse(readFileSync(new URL('../manifest.json',import.meta.url)));
 assert.deepEqual(m.features.slash_commands.map(c=>c.command),h.registrations.command);assert.deepEqual(m.settings.event_subscriptions.bot_events,h.registrations.event);assert.ok(m.settings.socket_mode_enabled&&m.settings.interactivity.is_enabled);assert.deepEqual(m.oauth_config.scopes.bot.sort(),['chat:write','commands','files:read','files:write','im:write']);assert.equal(m.features.shortcuts,undefined);
 const template=readFileSync(new URL('../.env.example',import.meta.url),'utf8');for(const key of ['SLACK_BOT_TOKEN','SLACK_APP_TOKEN','SLACK_TEAM_ID','HR_USER_IDS','DATA_PATH'])assert.ok(template.includes(key+'='));
});
