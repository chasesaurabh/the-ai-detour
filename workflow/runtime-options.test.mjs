import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeOptions } from './runtime-options.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
test('historical defaults are preserved and explicit allocation overrides are accepted', () => {
  assert.deepEqual(runtimeOptions([]), {fraction:'0.20',maxModelLength:'8192',dryRun:false});
  assert.equal(runtimeOptions([], '0.80').fraction, '0.80');
  assert.deepEqual(runtimeOptions(['--gpu-memory-utilization','0.8','--max-model-len','4096','--dry-run']), {fraction:'0.8',maxModelLength:'4096',dryRun:true});
});
test('both launchers dry-run actual Docker arguments without starting a container', () => {
  const root = mkdtempSync(join(tmpdir(), 'detour-runtime-test-'));
  try {
    for (const [file, before, revision, marker] of [
      ['model-runtime.mjs', ['start'], '1cfa9a7208912126459214e8b04321603b3df60c', 'model.safetensors.index.json'],
      ['../operations/model-runtime.mjs', ['start','small'], 'c1899de289a04d12100db370d81485cdf75e47ca', 'config.json']
    ]) {
      const p=join(root,'snapshots',revision);mkdirSync(p,{recursive:true});writeFileSync(join(p,marker),'{}');
      const r=spawnSync(process.execPath,[new URL(file,import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),...before,root,'--gpu-memory-utilization','0.75','--max-model-len','4096','--dry-run'],{encoding:'utf8',windowsHide:true});
      assert.equal(r.status,0,r.stderr);const parsed=JSON.parse(r.stdout.slice(r.stdout.indexOf('\n')+1));
      assert.equal(parsed.executable,'docker');assert.equal(parsed.args[parsed.args.indexOf('--gpu-memory-utilization')+1],'0.75');
      assert.equal(parsed.args[parsed.args.indexOf('--max-model-len')+1],'4096');assert.ok(parsed.args.includes('127.0.0.1:18084:8000'));
    }
  } finally { rmSync(root,{recursive:true,force:true}); }
});
test('invalid, missing, duplicated and unknown runtime options fail before Docker', () => {
  for (const args of [['--gpu-memory-utilization','0'],['--gpu-memory-utilization','1.1'],['--gpu-memory-utilization','NaN'],['--gpu-memory-utilization'],['--max-model-len','255'],['--max-model-len','4096.5'],['--max-model-len','9000'],['--max-model-len'],['--unknown'],['--dry-run','--dry-run']]) assert.throws(() => runtimeOptions(args));
});
