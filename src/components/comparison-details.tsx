"use client";
import { useState } from "react";
import type { IdeaInput, MapAnalysis } from "@/lib/analysis-data";
import styles from "./workspace.module.css";
export function ComparisonDetails({ analysis, ideas }: { analysis: MapAnalysis; ideas: IdeaInput[] }) {
  const [left, setLeft] = useState(ideas[0]?.id ?? "");
  const [right, setRight] = useState(ideas[ideas.length - 1]?.id ?? "");
  return <details className={styles.comparison}><summary>リンクされなかった因数も比較する</summary>
    <div className={styles.comparisonSelectors}><label>比較元<select value={left} onChange={event => setLeft(event.target.value)}>{ideas.map((idea, i) => <option value={idea.id} key={idea.id}>アイデア {i + 1}</option>)}</select></label><label>比較先<select value={right} onChange={event => setRight(event.target.value)}>{ideas.map((idea, i) => <option value={idea.id} key={idea.id}>アイデア {i + 1}</option>)}</select></label></div>
    {left === right ? <p>別のアイデアを選んでください。</p> : <div className={styles.comparisonTable}><table><thead><tr><th>因数</th><th>比較元</th><th>比較先</th><th>具体値の類似度</th><th>上位概念の類似度</th><th>判定</th></tr></thead><tbody>{analysis.factors.map(factor => {
      const a = analysis.values.find(v => v.ideaId === left && v.factorId === factor.id);
      const b = analysis.values.find(v => v.ideaId === right && v.factorId === factor.id);
      const matches = (pair: { source: string; target: string }) => (pair.source === a?.id && pair.target === b?.id) || (pair.source === b?.id && pair.target === a?.id);
      const comparison = analysis.comparisons?.find(matches);
      const similar = analysis.pairs.find(matches);
      const overlap = analysis.broaderPairs?.find(matches);
      const score = comparison?.score ?? similar?.score;
      const upperScore = analysis.broaderComparisons?.find(matches)?.score;
      const labels = [similar ? "具体的に近い" : "", overlap ? `${overlap.method === "semantic" ? "意味確認" : "上位概念"}：${overlap.sharedConcept}` : ""].filter(Boolean);
      return <tr key={factor.id}><th>{factor.name}</th><td>{a?.label ?? "情報不足"}</td><td>{b?.label ?? "情報不足"}</td><td>{score === undefined ? "未記録" : `${score.toFixed(3)} / 基準 ${analysis.thresholds?.[factor.id] ?? "—"}`}</td><td>{upperScore === undefined ? "—" : `${upperScore.toFixed(3)} / 基準 ${analysis.broaderThresholds?.[factor.id] ?? "—"}`}</td><td>{labels.join(" / ") || (!a || !b ? "比較対象なし" : score === undefined ? "未リンク" : "基準未満")}</td></tr>;
    })}</tbody></table></div>}
    <p>類似度は確率ではありません。上位概念はAIが抽象化した候補です。「意味確認」は数値の基準とは別に、双方の具体値に共通原理があるか確認した接点です。以前の結果は未保存の数値を「未記録」と表示します。</p>
  </details>;
}
