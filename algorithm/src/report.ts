import type { Analysis, Config, Idea } from './types.ts';
export function formatReport(result: Analysis, ideas: Idea[], config: Config): string {
  const lines = [`実行方式: ${result.provider.mode}`, `類似判定のしきい値: ${config.similarityThreshold}（確率ではありません）`];
  for (const [i, idea] of ideas.entries()) {
    lines.push(`\n【アイデア${i + 1}の因数分解】`);
    for (const factor of config.factors) {
      const v = result.values.find(v => v.ideaId === idea.id && v.factorId === factor.id);
      lines.push(`${factor.name}: ${v ? v.label + (v.inferred ? ' ［推測］' : '') : 'null（情報不足）'}`);
      if (v) lines.push(`  上位概念: ${v.broaderConcept ?? '未特定'}`);
    }
  }
  lines.push('\n【同じ因数の比較】');
  for (const factor of config.factors) {
    const pair = result.comparisons.find(p => p.factorId === factor.id);
    lines.push(`${factor.name}: ${pair ? `${pair.score.toFixed(4)} / ${result.pairs.some(p => p.source === pair.source && p.target === pair.target) ? '近い' : 'しきい値未満・除外'} / 基準=${config.factorThresholds?.[factor.id] ?? config.similarityThreshold}` : '比較対象なし（一方または両方がnull）'}`);
  }
  lines.push('\n【共通部分とラベル】');
  if (!result.pairs.length) lines.push('現在のしきい値を満たす共通部分はありません。');
  for (const pair of result.pairs) {
    const a = result.values.find(v => v.id === pair.source)!;
    const b = result.values.find(v => v.id === pair.target)!;
    const label = result.labels.find(l => l.memberIds.includes(a.id) && l.memberIds.includes(b.id));
    lines.push(`${config.factors.find(f => f.id === pair.factorId)!.name}: 「${a.label}」 ↔ 「${b.label}」`);
    if (a.inferred || b.inferred) lines.push('  ［推測した値を含む共通部分］');
    lines.push(label ? `  暫定共通ラベル: ${label.label} / 平均ベクトルとの類似度: ${label.score.toFixed(4)}` : '  ラベル未生成（処理上限など）');
    if (label) lines.push(`  候補: ${label.candidates.map(c => `${c.label}（平均=${c.score.toFixed(4)}${c.memberScore === undefined ? '' : `、両側の最低=${c.memberScore.toFixed(4)}`}${c.eligible === false ? '、基準外' : ''}）`).join('、')}`);
  }
  if (result.broaderPairs?.length) {
    lines.push('\n【上位概念の関連候補】');
    for (const relation of result.broaderPairs) {
      const a = result.values.find(v => v.id === relation.source)!;
      const b = result.values.find(v => v.id === relation.target)!;
      lines.push(`「${a.label}」 ↔ 「${b.label}」：上位概念「${relation.sourceConcept}」 ↔ 「${relation.targetConcept}」、類似度=${relation.score.toFixed(4)}、共通候補「${relation.sharedConcept}」`);
    }
  }
  lines.push('\n共通ラベルは平均への近さと元の両方の値への近さで選びます。元の値は保持しています。');
  return lines.join('\n');
}
