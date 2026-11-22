import { cp, mkdir, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

try {
  if (process.argv.length !== 3) throw new Error('Usage: npm run lab:prepare -- <new-directory>');
  const root = await realpath(fileURLToPath(new URL('../..', import.meta.url)));
  const requested = resolve(process.argv[2]);
  // Resolve the parent first, including junctions/symlinks; parent must exist.
  const parent = await realpath(dirname(requested));
  const target = resolve(parent, basename(requested));
  const rel = relative(root, target);
  const outside = rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel);
  if (!outside) throw new Error('Choose a directory outside the companion');
  await mkdir(target); // Exclusive creation: never merge into an existing path.
  await cp(new URL('./start/', import.meta.url), target, { recursive: true, force: false, errorOnExist: true });
  console.log('Exercise created. In that directory run npm ci, then npm test. Expected failures expose the teaching defect.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Preparation failed');
  process.exitCode = 2;
}
