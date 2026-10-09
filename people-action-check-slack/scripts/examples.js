import * as v from '../src/views.js';
import {RISK_ON_YES} from '../src/scoring.js';
export function fixtures(){
 const sample=(scenarios=v.names)=>({id:'synthetic-check',revision:1,scoringVersion:2,employee:'Synthetic employee',stage:'done',page:0,scenarios,answers:scenarios.flatMap(n=>Array.from({length:5},(_,i)=>RISK_ON_YES[n]?.includes(i)?'no':'yes')),notes:scenarios.flatMap(()=>Array(5).fill('')),completedAt:'2026-09-29T12:00:00Z'});
 const r=sample(), p={id:'synthetic-policy',revision:1,name:'Sample policy',category:'performance',content:'Company policy example. https://example.com/policy'},s={...r,id:'synthetic-submission',submittedBy:'UDEMO',submittedAt:'2026-09-29T12:00:00Z',reviewStatus:'New',reviewRevision:0,attachments:'https://example.com/evidence',delivery:{UDEMO:{status:'sent',report:true},UHR:{status:'failed',error:'Slack is rate limiting requests. Wait a moment and retry.'}}};
 const examples={home:v.home([r],[p],true),home_empty:v.home([],[]),home_paginated:v.home(Array(40).fill(r),[p],true,1),selection:v.picker(),context:v.wizard({...r,stage:'context'}),questions:v.wizard({...r,stage:'questions'},[p]),assessment:v.result(r),legacy_assessment:v.result({...r,scoringVersion:undefined}),hr_review:v.result(s,0,true),policy_editor:v.policyForm(p),policies:v.policyList([p],true),policies_empty:v.policyList([],false),policies_paginated:v.policyList(Array(30).fill(p),true,1),policy_read:v.policyRead(p),supporting_links:v.supportingForm(r),followup:v.followupForm(r),share_confirmation:v.shareForm(r,['UHR']),delete_check:v.deleteForm(r.id,'check'),delete_policy:v.deleteForm(p.id,'policy'),clear_history:v.clearHistoryForm(3),inbox:v.inbox([s]),inbox_empty:v.inbox([]),inbox_paginated:v.inbox(Array(40).fill(s),1),governance:v.governanceCenter({audits:[{createdAt:'2026-09-29T12:00:00Z',action:'submission.created',actor:'UDEMO',targetKind:'submission'}],checks:3,submissions:1,policies:2,reviewers:1,retentionDays:365}),delivery:v.deliveryView(s),error:v.notice('The record is unavailable. Close and reopen from Home.'),report_sent:v.notice('Your Word report was sent to your private app DM.'),hr_message:v.hrMessage(s)};
 for(const [i,name] of v.names.entries()){
  const single=sample([name]);
  examples[`scenario_${i+1}_context`]=v.wizard({...single,stage:'context'});
  examples[`scenario_${i+1}_questions`]=v.wizard({...single,stage:'questions'});
  examples[`scenario_${i+1}_result`]=v.result(single);
  examples[`combined_${i+1}_questions`]=v.wizard({...r,page:i,stage:'questions'});
  examples[`combined_${i+1}_result`]=v.result(r,i);
 }
 examples.maximum_notes=v.result({...r,notes:Array(50).fill('N'.repeat(1500)),attachments:'A'.repeat(3000)});
 examples.maximum_policy=v.policyRead({...p,content:'P'.repeat(3000)});
 examples.high_risk=v.result({...r,answers:Array(50).fill('unknown')});
 return examples;
}
