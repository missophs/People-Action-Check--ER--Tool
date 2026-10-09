import assert from 'node:assert/strict';
const length=(s,max,label)=>assert.ok(typeof s==='string'&&Array.from(s).length>0&&Array.from(s).length<=max,`${label} length`);
const text=(x,max)=>{assert.ok(['plain_text','mrkdwn'].includes(x?.type));length(x.text,max,'text');};
export function validatePayload(payload){
 const view=['home','modal'].includes(payload.type);
 assert.ok(Array.isArray(payload.blocks)&&payload.blocks.length>0&&payload.blocks.length<=(view?100:50));
 if(!view)length(payload.text,40000,'message fallback');
 if(payload.type==='modal'){
  assert.equal(payload.title.type,'plain_text');text(payload.title,24);
  if(payload.close)text(payload.close,24);if(payload.submit)text(payload.submit,24);
  length(payload.callback_id,255,'callback_id');
  assert.ok((payload.private_metadata||'').length<=3000);
  if(payload.blocks.some(b=>b.type==='input'))assert.ok(payload.submit);
 }
 const blocks=new Set();
 for(const b of payload.blocks){
  if(b.block_id){length(b.block_id,255,'block_id');assert.ok(!blocks.has(b.block_id));blocks.add(b.block_id);}
  assert.ok(['section','actions','input','header','divider','context'].includes(b.type),'supported block in app');
  if(b.type==='section')text(b.text,3000);
  if(b.type==='header'){assert.equal(b.text.type,'plain_text');text(b.text,150);}
  if(b.type==='context'){assert.ok(b.elements.length>0&&b.elements.length<=10);for(const e of b.elements)text(e,3000);}
  if(b.type==='input'){
   assert.equal(payload.type,'modal');assert.equal(b.label.type,'plain_text');text(b.label,2000);
   const e=b.element;length(e.action_id,255,'action_id');
   assert.ok(['static_select','multi_static_select','plain_text_input','file_input'].includes(e.type));
   if(e.options){assert.ok(e.options.length>=1&&e.options.length<=100);const vals=new Set();for(const o of e.options){assert.equal(o.text.type,'plain_text');text(o.text,75);length(o.value,150,'option');assert.ok(!vals.has(o.value));vals.add(o.value);}if(e.initial_option)assert.ok(vals.has(e.initial_option.value));}
   if(e.type==='plain_text_input'){assert.ok(e.max_length<=3000);if(e.initial_value)length(e.initial_value,e.max_length,'initial_value');}
   if(e.type==='file_input'){assert.ok(e.max_files>=1&&e.max_files<=10);assert.ok(!b.dispatch_action);if(e.filetypes)assert.ok(e.filetypes.length>0);}
  }
  if(b.type==='actions'){
   assert.ok(b.elements.length>0&&b.elements.length<=25);const ids=new Set();
   for(const e of b.elements){assert.equal(e.type,'button');text(e.text,75);length(e.action_id,255,'action_id');assert.ok(!ids.has(e.action_id));ids.add(e.action_id);length(e.value,2000,'button value');if(e.accessibility_label)length(e.accessibility_label,75,'accessibility');}
  }
 }
 return true;
}
