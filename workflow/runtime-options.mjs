export function runtimeOptions(args, defaultFraction = '0.20') {
  const options = { fraction: defaultFraction, maxModelLength: '8192', dryRun: false };
  const seen = new Set();
  for (let i = 0; i < args.length; i++) {
    const key = args[i];
    if (seen.has(key)) throw new Error('Duplicate runtime option: ' + key);
    seen.add(key);
    if (key === '--dry-run') { options.dryRun = true; continue; }
    if (!['--gpu-memory-utilization', '--max-model-len'].includes(key)) throw new Error('Unknown runtime option: ' + key);
    const value = args[++i];
    if (key === '--gpu-memory-utilization') {
      if (!value || !/^(?:0?\.\d+|1(?:\.0+)?)$/.test(value) || Number(value) <= 0 || Number(value) > 1) throw new Error('GPU fraction must be greater than 0 and at most 1');
      options.fraction = value;
    } else {
      if (!value || !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < 256 || Number(value) > 8192) throw new Error('Model length must be an integer from 256 to 8192 for this teaching recipe');
      options.maxModelLength = value;
    }
  }
  return options;
}
