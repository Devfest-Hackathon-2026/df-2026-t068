import { createInterface } from 'node:readline';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { analyze } from './core.ts';
import { createProvider } from './provider.ts';
import { formatReport } from './report.ts';
import type { Config, Idea } from './types.ts';

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
const input = rl[Symbol.asyncIterator]();
try {
  const c: Config = JSON.parse(await readFile(new URL('../config/default.json', import.meta.url), 'utf8'));
  const threshold = process.argv.find(a => a.startsWith('--threshold='));
  if (threshold) c.similarityThreshold = Number(threshold.slice(12));
  const ideas: Idea[] = [];
  for (let i = 1; i <= 2; i++) {
    process.stderr.write(`アイデア${i}を1行で入力してEnterを押してください:\n> `);
    const line = await input.next();
    if (line.done || !line.value.trim()) throw new Error(`アイデア${i}が空です。2行の入力が必要です。`);
    if (line.value.length > c.maxTextLength) throw new Error(`アイデア${i}は${c.maxTextLength}文字以内にしてください。`);
    ideas.push({ id: `idea-${i}`, text: line.value.trim() });
  }
  rl.close();
  process.stderr.write('\n分析中です。\n');
  const result = await analyze(ideas, c, createProvider(process.argv.includes('--mock')));
  const report = formatReport(result, ideas, c);
  console.log(report);
  await mkdir('output', { recursive: true });
  await writeFile('output/interactive-analysis.json', JSON.stringify({ ...result, ideas }, null, 2), 'utf8');
  await writeFile('output/interactive-report.txt', report, 'utf8');
  process.stderr.write('\n詳細: output/interactive-analysis.json\n読みやすい結果: output/interactive-report.txt\n');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Analysis failed');
  process.exitCode = 1;
} finally { rl.close(); }
