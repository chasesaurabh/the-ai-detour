import { spawn, spawnSync } from 'node:child_process';

export async function boundedProcess(executable: string, args: string[], options: {
  cwd: string; input?: string; milliseconds: number;
  onStdout?: (chunk: string) => void; onStderr?: (chunk: string) => void;
}): Promise<{ code: number | null; timedOut: boolean }> {
  if (!Number.isSafeInteger(options.milliseconds) || options.milliseconds < 1) throw new Error('Invalid time limit');
  const child = spawn(executable, args, { cwd: options.cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  child.stdout.on('data', chunk => options.onStdout?.(chunk.toString()));
  child.stderr.on('data', chunk => options.onStderr?.(chunk.toString()));
  child.stdin.on('error', error => { if ((error as NodeJS.ErrnoException).code !== 'EPIPE') child.emit('error', error); });
  child.stdin.end(options.input ?? '');
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    if (process.platform === 'win32' && child.pid) {
      const killed = spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true });
      if (killed.status !== 0) child.kill('SIGTERM');
    } else child.kill('SIGTERM');
  }, options.milliseconds);
  try {
    const code = await new Promise<number | null>((ok, fail) => { child.on('close', ok); child.on('error', fail); });
    return { code, timedOut };
  } finally { clearTimeout(timer); }
}
