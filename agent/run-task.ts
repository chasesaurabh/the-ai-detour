import { boundedProcess } from './process.ts';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, readdirSync, lstatSync, realpathSync, existsSync } from 'node:fs';
import { resolve, relative, isAbsolute, join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// Run directly with Node 24+ TypeScript stripping. This is an orchestration
// wrapper around an existing coding harness, not a newly implemented model loop.
const [workspaceArg, outputArg] = process.argv.slice(2);
if (!workspaceArg || !outputArg || process.argv.length !== 4) throw new Error('Usage: npm run agent:run -- <exercise> <new-output-directory>');
const workspace = realpathSync(workspaceArg);
const requestedOutput = resolve(outputArg);
const output = join(realpathSync(dirname(requestedOutput)), basename(requestedOutput));
const rel = relative(workspace, output);
if (!isAbsolute(rel) && rel !== '..' && !rel.startsWith('..\\') && !rel.startsWith('../')) throw new Error('Keep run records outside the agent workspace');
if (!existsSync(join(workspace, 'ISSUE.md'))) throw new Error('Expected a prepared exercise with ISSUE.md');
mkdirSync(output); // Never overwrite an earlier run.
const cli = fileURLToPath(new URL('../node_modules/@openai/codex/bin/codex.js', import.meta.url));
const maxMilliseconds = 10 * 60_000;
const started = Date.now();

function inventory(dir: string, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  for (const name of readdirSync(dir)) {
    if (['node_modules', 'dist', '.git'].includes(name)) continue;
    const path = join(dir, name), key = prefix + name, stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error('Exercise must not contain symlinks or junctions: ' + key);
    if (stat.isDirectory()) Object.assign(result, inventory(path, key + '/'));
    else result[key] = createHash('sha256').update(readFileSync(path)).digest('hex');
  }
  return result;
}
const before = inventory(workspace);
writeFileSync(join(output, 'before.json'), JSON.stringify(before, null, 2));
const prompt = `Read README.md and ISSUE.md in this workspace. Complete the issue from investigation through implementation, tests and documentation. Choose and execute the necessary steps without requesting another prompt for each step. Follow ISSUE.md boundaries. Run the baseline before editing. Preserve all existing tests and package/config files. Use only this workspace and the local synthetic MongoDB. No extra packages, outside directories, credentials, Git actions, publishing or external communications. Do not use other agents. If permissions prevent work, report the blocker; do not bypass them. Finish with the requested review packet and exact observed checks. You have at most ten minutes; this is a bounded engineering exercise, not a speed benchmark.`;
writeFileSync(join(output, 'assignment.txt'), prompt);
const args = [cli, 'exec', '--ignore-user-config', '--ephemeral', '--json', '--skip-git-repo-check',
  '-c', 'approval_policy="never"',
  '-c', 'windows.sandbox="mxc"',
  '-c', 'permissions.detour.extends=":workspace"',
  '-c', 'permissions.detour.network.enabled=true',
  '-c', 'features.network_proxy.enabled=true',
  '-c', 'features.network_proxy.allow_local_binding=true',
  '-c', 'default_permissions="detour"',
  '-c', `projects.${JSON.stringify(workspace)}.trust_level="trusted"`,
  '-C', workspace, '-o', join(output, 'agent-final.md'), '-'];
writeFileSync(join(output, 'invocation.json'), JSON.stringify({ executable: process.execPath, args, started: new Date(started).toISOString(), maxMilliseconds, model: 'CLI default; identify from emitted evidence if available', permissionNote: 'Windows MXC workspace writes with managed networking. MXC permits host loopback, not just the MongoDB port. No external proxy domains allowed. No global config edit.' }, null, 2));
let events = '', stderr = '';
const { code, timedOut } = await boundedProcess(process.execPath, args, {
  cwd: workspace, input: prompt, milliseconds: maxMilliseconds,
  onStdout: chunk => { events += chunk; writeFileSync(join(output, 'events.jsonl'), events); },
  onStderr: chunk => { stderr += chunk; writeFileSync(join(output, 'stderr.txt'), stderr); },
});
const after = inventory(workspace);
const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter(key => before[key] !== after[key]).sort();
const violations = changed.filter(key => !(key.startsWith('src/') || key === 'README.md' || (key.startsWith('tests/') && !(key in before))) || !(key in after));
const summary = { agentExitCode: code, timedOut, elapsedSeconds: (Date.now() - started) / 1000, changed, violations, status: violations.length ? 'scope_violation' : timedOut ? 'timed_out' : code === 0 ? 'awaiting_independent_verification' : 'agent_failed', humanFollowupPromptsDuringRun: 0 };
writeFileSync(join(output, 'after.json'), JSON.stringify(after, null, 2));
writeFileSync(join(output, 'run-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
if (code !== 0 || timedOut || violations.length) process.exitCode = 1;
