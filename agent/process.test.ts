import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { boundedProcess } from './process.ts';

test('captures normal completion and failed exit distinctly', async () => {
  let stdout = '';
  const good = await boundedProcess(process.execPath, ['-e', 'console.log("observed")'], { cwd: process.cwd(), milliseconds: 5000, onStdout: x => stdout += x });
  assert.deepEqual(good, { code: 0, timedOut: false });
  assert.match(stdout, /observed/);
  const bad = await boundedProcess(process.execPath, ['-e', 'process.exitCode=7'], { cwd: process.cwd(), milliseconds: 5000 });
  assert.deepEqual(bad, { code: 7, timedOut: false });
});

test('Windows timeout terminates a child tree before its delayed write', { skip: process.platform !== 'win32' }, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'detour-timeout-'));
  const marker = join(dir, 'late.txt');
  // JSON encodes JavaScript literals here; no shell interprets this string.
  const childCode = `setTimeout(()=>require('fs').writeFileSync(${JSON.stringify(marker)},'unexpected'),2500)`;
  const parentCode = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(childCode)}],{stdio:'inherit'});console.log('child-started');setInterval(()=>{},1000)`;
  let output = '';
  try {
    const result = await boundedProcess(process.execPath, ['-e', parentCode], { cwd: dir, milliseconds: 1000, onStdout: x => output += x });
    assert.equal(result.timedOut, true);
    assert.notEqual(result.code, 0);
    assert.match(output, /child-started/);
    await setTimeout(2100);
    assert.equal(existsSync(marker), false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
