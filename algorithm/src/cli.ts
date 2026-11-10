import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { analyze } from './core.ts';
import { createProvider } from './provider.ts';
import type { Config, Idea } from './types.ts';

try {
  const args = process.argv.slice(2);
  const mock = args.includes('--mock');
  const input = args.find(a => !a.startsWith('--'));
  if (!input) throw new Error('Usage: node src/cli.ts [--mock] input.json [--config=path] [--out=path]');
  const configPath = args.find(a => a.startsWith('--config='))?.slice(9);
  const c: Config = JSON.parse(await readFile(configPath ?? new URL('../config/default.json', import.meta.url), 'utf8'));
  const ideas: Idea[] = JSON.parse(await readFile(input, 'utf8'));
  const provider = createProvider(mock);
  const result = await analyze(ideas, c, provider);
  const output = args.find(a => a.startsWith('--out='))?.slice(6) ?? 'output/analysis.json';
  await mkdir((await import('node:path')).dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(result, null, 2), 'utf8');
  console.log(`${provider.metadata.mode}: ${result.values.length} values, ${result.pairs.length} pairs, ${result.labels.length} labels -> ${output}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Analysis failed');
  process.exitCode = 1;
}
