import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { replay } from './replay.ts';
import { formatReport } from './report.ts';
import type { Analysis, Config, Idea } from './types.ts';
try {
  const args = process.argv.slice(2);
  const file = args.find(a => !a.startsWith('--')) ?? 'output/interactive-analysis.json';
  const saved: Analysis & { ideas?: Idea[] } = JSON.parse(await readFile(file, 'utf8'));
  const configPath = args.find(a => a.startsWith('--config='))?.slice(9);
  const config: Config = configPath ? JSON.parse(await readFile(configPath, 'utf8')) : structuredClone(saved.settings ?? JSON.parse(await readFile(new URL('../config/default.json', import.meta.url), 'utf8')));
  const threshold = args.find(a => a.startsWith('--threshold='));
  if (threshold) { config.similarityThreshold = Number(threshold.slice(12)); config.factorThresholds = {}; }
  const result = await replay(saved, config);
  const ideas = saved.ideas ?? [...new Set(saved.values.map(v => v.ideaId))].map(id => ({ id, text: '' }));
  console.log('保存済みデータによる再評価です。API呼び出しはありません。新しい語句は生成せず、保存済み候補の範囲で評価します。');
  console.log(formatReport(result, ideas, config));
  await mkdir('output', { recursive: true });
  await writeFile('output/replay-analysis.json', JSON.stringify({ ...result, ideas }, null, 2), 'utf8');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Replay failed');
  process.exitCode = 1;
}
