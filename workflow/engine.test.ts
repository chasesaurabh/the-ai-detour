import { test } from 'node:test';
import assert from 'node:assert/strict';
import { initial, advance, type Model } from './engine.ts';
import { executeTool } from './tools.ts';
import { connectContext } from './mcp-client.ts';
import { localModel } from './model.ts';

const execute=async(name:string,args:unknown)=>executeTool(name,args);
const steps=[...['issue','contract','implementation'].map(key=>({action:'tool',name:'read_context',args:{key}})),...['offsets','boundary'].map(scenario=>({action:'tool',name:'run_probe',args:{scenario}})),{action:'finish',diagnosis:'The comparison uses lexical order instead of comparing instants.',evidence:['issue','contract','implementation','probe-offsets','probe-boundary'],next_step:'Compare parsed instants and add regression checks.'}];
// These are deterministic controller tests, not model-run evidence.
function scripted():Model {let i=0;return async()=>JSON.stringify(steps[i++]);}
test('completion needs observed evidence; fabricated citations do not satisfy gate',async()=>{
 const s=initial('fixture');await advance(s,async()=>JSON.stringify(steps[5]),execute,()=>{});
 assert.equal(s.status,'escalated');assert.equal(s.evidence.length,0);assert.equal(s.steps,2);
});
test('unknown tools and extra arguments cannot execute',async()=>{
 assert.throws(()=>executeTool('shell',{command:'anything'}));assert.throws(()=>executeTool('read_context',{key:'issue',path:'../secret'}));
 const s=initial('fixture');await advance(s,async()=>JSON.stringify({action:'tool',name:'shell',args:{}}),execute,()=>{});
 assert.equal(s.status,'escalated');assert.equal(s.evidence.length,0);
});
test('actual seeded probes expose offset and equality defects',()=>{
 const offset=executeTool('run_probe',{scenario:'offsets'}).data as {passes:boolean}[];
 assert.deepEqual(offset.map(x=>x.passes),[false,false]);
 assert.equal((executeTool('run_probe',{scenario:'boundary'}).data as {passes:boolean}[])[0]!.passes,false);
});
test('checkpoint serialization preserves cumulative budget and evidence through resume',async()=>{
 const s=initial('fixture');const model=scripted();await advance(s,model,execute,()=>{},2);
 assert.equal(s.status,'paused');assert.equal(s.steps,2);
 const fresh=JSON.parse(JSON.stringify(s));await advance(fresh,model,execute,()=>{});
 assert.equal(fresh.status,'awaiting_review');assert.equal(fresh.steps,6);assert.equal(fresh.evidence.length,5);
});
test('repeated valid tool calls exhaust the total budget across resumes',async()=>{
 const s=initial('fixture');const model=async()=>JSON.stringify(steps[0]);await advance(s,model,execute,()=>{},2);await advance(s,model,execute,()=>{});
 assert.equal(s.steps,8);assert.equal(s.status,'exhausted');
});
test('changed sources and interrupted in-flight request fail closed',async()=>{
 const s=initial('fixture');s.fingerprint='changed';await assert.rejects(advance(s,scripted(),execute,()=>{}));
 const t=initial('fixture');t.inFlight=true;let calls=0;await advance(t,async()=>{calls++;return '{}';},execute,()=>{});assert.equal(calls,0);assert.equal(t.status,'uncertain');
});
test('request timeout stops a model that does not return',async()=>{
 const s=initial('fixture');await advance(s,()=>new Promise(()=>{}),execute,()=>{},Infinity,20);assert.equal(s.status,'failed');assert.equal(s.steps,1);assert.equal(s.inFlight,false);
});
test('malformed JSON consumes a bounded retry rather than executing',async()=>{
 const s=initial('fixture');await advance(s,async()=>'{broken',execute,()=>{});assert.equal(s.status,'escalated');assert.equal(s.evidence.length,0);
});
test('checkpoint cannot increase its budget or replace a typed counter',async()=>{
 const s=initial('fixture');s.maxSteps=100;await assert.rejects(advance(s,scripted(),execute,()=>{}));
 const t=initial('fixture');(t as unknown as {steps:string}).steps='0';await assert.rejects(advance(t,scripted(),execute,()=>{}));
});
test('local adapter rejects remote or credential-bearing destinations',()=>{
 assert.throws(()=>localModel('http://example.com/v1/chat/completions','fixture'));
 assert.throws(()=>localModel('http://user:secret@127.0.0.1:80','fixture'));
});
test('real MCP discovery and tools agree with direct execution; unknown tool rejected',async()=>{
 const c=await connectContext();try {
  assert.deepEqual(c.discovered.tools.map(t=>t.name).sort(),['read_context','run_probe']);
  for(const [name,args] of [['read_context',{key:'issue'}],['run_probe',{scenario:'offsets'}]] as const){const a=await c.execute(name,args),b=executeTool(name,args);assert.deepEqual(a.data,b.data);assert.equal(a.sha256,b.sha256);}
  await assert.rejects(c.execute('delete_ticket',{}));
 }finally{await c.close();}
});
