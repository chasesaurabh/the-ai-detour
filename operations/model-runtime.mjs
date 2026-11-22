import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {existsSync} from 'node:fs';
import {runtimeOptions} from '../workflow/runtime-options.mjs';
const configs={small:{revision:'c1899de289a04d12100db370d81485cdf75e47ca',served:'detour-qwen3-06b',fraction:'0.20'},large:{revision:'9216db5781bf21249d130ec9da846c4624c16137',served:'detour-qwen3-32b',fraction:'0.80'}};
const [mode,size,folder,...flags]=process.argv.slice(2),c=configs[size];if(!c)throw Error('Choose small or large');
const options=runtimeOptions(flags,c.fraction);
const name='ai-detour-eval-'+size;let args;
if(mode==='stop')args=['stop',name];else if(mode==='resume')args=['start',name];else if(mode==='start'&&folder){
 const root=resolve(folder);if(!existsSync(resolve(root,'snapshots',c.revision,'config.json')))throw Error('Pinned snapshot missing');
 args=['run','-d','--name',name,'--gpus','all','-p','127.0.0.1:18084:8000','--mount',`type=bind,source=${root},target=/model,readonly`,'-e','HF_HUB_OFFLINE=1','-e','TRANSFORMERS_OFFLINE=1','--shm-size=2g','vllm/vllm-openai:v0.30.0','--model',`/model/snapshots/${c.revision}`,'--served-model-name',c.served,'--max-model-len','8192','--max-num-seqs','1','--gpu-memory-utilization',c.fraction,'--enforce-eager'];
}else throw Error('npm run model:variant -- start small|large <cache-directory>, or stop small|large');
if(mode==='start'){
 args[args.indexOf('--gpu-memory-utilization')+1]=options.fraction;
 args[args.indexOf('--max-model-len')+1]=options.maxModelLength;
 console.log(JSON.stringify({gpuMemoryFraction:options.fraction,maxModelLength:options.maxModelLength,dryRun:options.dryRun,note:'Creation settings; resume preserves them. Inspect startup logs; allocation is not proof the model fits.'}));
}
if(options.dryRun){console.log(JSON.stringify({executable:'docker',args},null,2));process.exit(0);}
const result=spawnSync('docker',args,{stdio:'inherit',shell:false});if(result.error)throw result.error;process.exitCode=result.status??1;
