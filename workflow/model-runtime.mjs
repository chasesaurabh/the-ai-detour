import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { runtimeOptions } from './runtime-options.mjs';
const name='ai-detour-loop-model';
const [mode,cache,...flags]=process.argv.slice(2);
const options=runtimeOptions(flags);
let args;
if(mode==='stop') args=['stop',name];
else if(mode==='resume') args=['start',name];
else if(mode==='status') args=['logs','--tail','20',name];
else if(mode==='start'&&cache){
 const root=resolve(cache),revision='1cfa9a7208912126459214e8b04321603b3df60c';
 if(!existsSync(resolve(root,'snapshots',revision,'model.safetensors.index.json'))) throw new Error('Expected the pinned Qwen3-4B cache directory; see workflow/README.md');
 args=['run','-d','--name',name,'--gpus','all','-p','127.0.0.1:18084:8000','--mount',`type=bind,source=${root},target=/model,readonly`,'-e','HF_HUB_OFFLINE=1','-e','TRANSFORMERS_OFFLINE=1','--shm-size=2g','vllm/vllm-openai:v0.30.0','--model',`/model/snapshots/${revision}`,'--served-model-name','detour-qwen3-4b','--max-model-len','8192','--max-num-seqs','1','--gpu-memory-utilization','0.20','--enforce-eager','--enable-auto-tool-choice','--tool-call-parser','hermes'];
} else throw new Error('Use npm run model:start -- <Qwen3-4B cache directory> [--gpu-memory-utilization fraction] [--max-model-len tokens] [--dry-run] for first creation, model:resume for an existing stopped container, model:status, or model:stop');
if(mode==='start'){
 args[args.indexOf('--gpu-memory-utilization')+1]=options.fraction;
 args[args.indexOf('--max-model-len')+1]=options.maxModelLength;
 console.log(JSON.stringify({gpuMemoryFraction:options.fraction,maxModelLength:options.maxModelLength,dryRun:options.dryRun,note:'Fraction is of total GPU memory, not a fit guarantee. Inspect startup logs and available memory. Options apply at container creation; resume preserves prior settings.'}));
}
if(options.dryRun){console.log(JSON.stringify({executable:'docker',args},null,2));process.exit(0);}
const result=spawnSync('docker',args,{stdio:'inherit',shell:false});
if(result.error) throw result.error;process.exitCode=result.status??1;
