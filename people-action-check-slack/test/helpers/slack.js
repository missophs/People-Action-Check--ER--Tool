import bolt from '@slack/bolt';
import assert from 'node:assert/strict';
import { Store } from '../../src/store.js';
import { registerHandlers } from '../../src/handlers.js';
import * as v from '../../src/views.js';
import { validatePayload } from '../../src/validate.js';
export const TEAM='TTEST1', USER='UTEST1', HR='UHR1';
export const sample=(scenarios=[v.names[0]])=>({id:'check1',revision:1,scoringVersion:2,employee:'Synthetic Employee',stage:'done',page:0,scenarios,answers:scenarios.flatMap(()=>Array(5).fill('yes')),notes:scenarios.flatMap(()=>Array(5).fill('')),completedAt:'2026-09-29T12:00:00Z'});
export function state(view, overrides={}) {
 const values={};
 for(const b of view.blocks.filter(b=>b.type==='input')) {
  const e=b.element, x=Object.hasOwn(overrides,b.block_id)?overrides[b.block_id]:view.state?.values?.[b.block_id]?.value?.value??view.state?.values?.[b.block_id]?.value?.selected_option?.value??e.initial_value??e.initial_option?.value??e.initial_options?.map(o=>o.value)??'';
  values[b.block_id]={value:e.type==='static_select'?{type:e.type,selected_option:x?e.options.find(o=>o.value===x)||{value:x}:null}:e.type==='multi_static_select'?{type:e.type,selected_options:(x||[]).map(value=>({value}))}:e.type==='file_input'?{type:e.type,files:Array.isArray(x)?x:[]}:{type:e.type,value:x||null}};
 }
 return {values};
}
export function harness(t,{store=new Store(':memory:'),hrs=[HR]}={}) {
 const calls=[], acks=[], logs=[], fail={}; let current, serial=0;
 const receiver={init(){},async start(){},async stop(){}};
 const app=new bolt.App({receiver,authorize:async()=>({botId:'BTEST',botUserId:'UBOT',teamId:TEAM}),ignoreSelf:false,logLevel:'error'});
 const add=(method,fn)=>async arg=>{
  calls.push({method,arg});
  if(fail[method])throw fail[method];
  return fn?fn(arg):{ok:true};
 };
 for(const method of ['open','update','push'])app.client.views[method]=add('views.'+method,arg=>{
  validatePayload(arg.view);
  if(method==='update')assert.ok(arg.view_id,'views.update requires a view_id');
  const previous=current;current={...structuredClone(arg.view),id:arg.view_id||'V'+(++serial),hash:'h'+serial};if(method==='update')preserve(previous,current);
  return {ok:true,view:current};
 });
 app.client.views.publish=add('views.publish',arg=>{validatePayload(arg.view);return {ok:true};});
 app.client.conversations.open=add('conversations.open',arg=>({ok:true,channel:{id:'D'+arg.users}}));
 app.client.chat.postMessage=add('chat.postMessage',arg=>{validatePayload(arg);return {ok:true,ts:'1.1'};});
 app.client.files.uploadV2=add('files.uploadV2',arg=>{assert.equal(arg.file.subarray(0,2).toString(),'PK');return {ok:true};});
 const {registrations}=registerHandlers(app,{store,team:TEAM,hrs,logger:{error:x=>logs.push(x)}});
 t.after(()=>store.close());
 function preserve(old,next){const saved={};for(const b of next.blocks.filter(b=>b.type==='input'))if(old?.blocks?.some(x=>x.block_id===b.block_id&&x.element.action_id===b.element.action_id)&&old.state?.values?.[b.block_id])saved[b.block_id]=old.state.values[b.block_id];next.state={values:saved};}
 const ack=async payload=>{acks.push(payload);if(payload?.view){validatePayload(payload.view);const previous=current;current={...structuredClone(payload.view),id:current?.id||'V1',hash:'ack'+(++serial)};preserve(previous,current);}};
 async function dispatch(body){if(body.view?.type==='modal')current=body.view;const count=acks.length;const start=performance.now();await app.processEvent({body,ack});assert.equal(acks.length-count,1,'Slack request acknowledged exactly once');assert.ok(performance.now()-start<3000,'local handler execution under Slack deadline');return acks.at(-1);}
 return {app,store,calls,acks,logs,fail,registrations,get view(){return current;},
  seed(r=sample(),user=USER){return store.save('check',TEAM+':'+user,r);},
  command:()=>dispatch({command:'/people-check',team_id:TEAM,user_id:USER,trigger_id:'test-trigger',channel_id:'CTEST'}),
  event:(user=USER,tab='home')=>dispatch({type:'event_callback',team_id:TEAM,event:{type:'app_home_opened',user,tab}}),
  action:(id,value=id,{user=USER,view=current,team=TEAM}={})=>dispatch({type:'block_actions',team:{id:team},user:{id:user},trigger_id:'test-trigger',...(view?{view}:{}),actions:[{type:'button',action_id:id,value,block_id:'actions'}]}),
  submit:(overrides={},user=USER,view=current)=>dispatch({type:'view_submission',team:{id:TEAM},user:{id:user},view:{...view,state:state(view,overrides)}}),
  count:method=>calls.filter(c=>c.method===method).length,
 };
}
