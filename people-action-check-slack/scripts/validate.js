import {writeFileSync,readFileSync,mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {validatePayload} from '../src/validate.js';
import {registerHandlers} from '../src/handlers.js';
import {fixtures} from './examples.js';
const examples=fixtures();
mkdirSync('examples',{recursive:true});
const registrations={command:[],event:[],action:[],view:[]};
const fake={error(){}};for(const kind of Object.keys(registrations))fake[kind]=(id)=>registrations[kind].push(id);
registerHandlers(fake,{store:null,team:'TDEMO',hrs:['UHR']});
const matches=(pattern,id)=>typeof pattern==='string'?pattern===id:pattern.test(id);
let previous={};try{previous=Object.fromEntries(JSON.parse(readFileSync('docs/slack-validation.json')).results.filter(r=>r.ok&&r.payload===JSON.stringify(examples[r.name])).map(r=>[r.name,r]));}catch{}
const results=[];
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
for(const [name,payload] of Object.entries(examples)){
 validatePayload(payload);
 if(payload.submit)assert.equal(registrations.view.filter(x=>matches(x,payload.callback_id)).length,1,`Unmapped callback: ${payload.callback_id}`);
 for(const b of payload.blocks.filter(b=>b.type==='actions'))for(const e of b.elements)assert.equal(registrations.action.filter(x=>matches(x,e.action_id)).length,1,`Unmapped action: ${e.action_id}`);
 writeFileSync('examples/'+name+'.json',JSON.stringify(payload,null,2)+'\n');
 if(process.argv.includes('--remote')){
  const parameter=payload.type?'view':'blocks';
  const validationPayload=payload.type?payload:payload.blocks;
  if(previous[name]){results.push(previous[name]);continue;}
  let data;
  for(let attempt=0;attempt<5;attempt++){
  const response=await fetch('https://slack.com/api/blocks.validate',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({[parameter]:JSON.stringify(validationPayload)}),signal:AbortSignal.timeout(15000)});
  data=await response.json();
  if(data.error!=='ratelimited')break;
  const seconds=Math.max(1,Number(response.headers.get('retry-after'))||10);console.log(name+' rate limited; retry after '+seconds+'s');await wait(seconds*1000);
  }
  results.push({name,validatedPart:parameter,payload:JSON.stringify(payload),...data});console.log(name,JSON.stringify(data));if(!data.ok)process.exitCode=1;
  mkdirSync('docs',{recursive:true});writeFileSync('docs/slack-validation.json',JSON.stringify({validatedAt:new Date().toISOString(),results},null,2)+'\n');
  await wait(1100);
 }
}
const m=JSON.parse(readFileSync('manifest.json'));
assert.deepEqual(m.features.slash_commands.map(c=>c.command),registrations.command);
assert.deepEqual(m.settings.event_subscriptions.bot_events,registrations.event);
assert.deepEqual([...m.oauth_config.scopes.bot].sort(),['commands','chat:write','im:write','files:read','files:write'].sort());
assert.equal(m.settings.socket_mode_enabled,true);assert.equal(m.settings.interactivity.is_enabled,true);assert.equal(m.features.app_home.home_tab_enabled,true);assert.equal(m.features.shortcuts,undefined);
for(const file of ['src/app.js','src/handlers.js','src/store.js','src/content.js','src/views.js','src/scoring.js','src/config.js','.env.example','README.md','package-lock.json'])assert.ok(readFileSync(file).length);
if(results.length){mkdirSync('docs',{recursive:true});writeFileSync('docs/slack-validation.json',JSON.stringify({validatedAt:new Date().toISOString(),results},null,2)+'\n');}
console.log(`${Object.keys(examples).length} synthetic payloads: structure, handler mappings and manifest checks passed.`);
