import { mkdirSync, writeFileSync, readFileSync, existsSync, renameSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { initial, advance, checkpointSchema, type State } from './engine.ts';
import { executeTool } from './tools.ts';
import { localModel } from './model.ts';
import { connectContext } from './mcp-client.ts';

const [mode, folder, ...options]=process.argv.slice(2);
if (!['start','resume'].includes(mode??'') || !folder || options.some(o=>!/^--(?:mcp|pause-after=[1-8])$/.test(o))) throw new Error('Usage: npm run loop -- start|resume <run-directory> [--mcp] [--pause-after=2]');
const dir=resolve(folder), file=join(dir,'state.json');
if(mode==='start') { mkdirSync(dirname(dir),{recursive:true}); mkdirSync(dir); } // Refuse overwriting an existing run.
if(mode==='resume' && !existsSync(file)) throw new Error('Missing checkpoint');
const lock=join(dir,'writer.lock'); const fd=openSync(lock,'wx');
let mcp: Awaited<ReturnType<typeof connectContext>>|undefined;
try {
  const endpoint=process.env.DETOUR_MODEL_URL??'http://127.0.0.1:18084/v1/chat/completions';
  const modelName=process.env.DETOUR_MODEL??'detour-qwen3-4b';
  if(mode==='resume' && readFileSync(file).length>1000000) throw new Error('Checkpoint exceeds teaching limit');
  const state:State=mode==='start'?initial(modelName,options.includes('--mcp')?'mcp':'direct'):checkpointSchema.parse(JSON.parse(readFileSync(file,'utf8')));
  if(state.model!==modelName) throw new Error('Model changed; start a separate run');
  if(state.transport==='mcp') {mcp=await connectContext();writeFileSync(join(dir,`discovery-${mode}.json`),JSON.stringify(mcp.discovered,null,2));}
  const save=(s:State)=>{writeFileSync(file+'.tmp',JSON.stringify(s,null,2));renameSync(file+'.tmp',file);};
  const pause=Number(options.find(o=>o.startsWith('--pause-after='))?.split('=')[1]??Infinity);
  const result=await advance(state,localModel(endpoint,modelName),mcp?mcp.execute:async(name,args)=>executeTool(name,args),save,pause);
  writeFileSync(join(dir,`result-${mode}.json`),JSON.stringify(result,null,2));
  console.log(JSON.stringify({status:result.status,steps:result.steps,evidence:result.evidence.map(e=>e.id),errors:result.errors,final:result.final},null,2));
  if(!['paused','awaiting_review'].includes(result.status)) process.exitCode=1;
} finally {await mcp?.close();closeSync(fd);unlinkSync(lock);}
