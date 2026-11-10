"use client";
import type { IdeaInput, MapAnalysis } from "@/lib/analysis-data";
import styles from "./workspace.module.css";

export function FactorOverview({ analysis, ideas, onCompare }: { analysis: MapAnalysis; ideas: IdeaInput[]; onCompare: (factorId: string) => void }) {
  return <section className={styles.factorOverview} aria-labelledby="factor-overview-title">
    <h3 id="factor-overview-title">すべての因数</h3><p>共通しない値も省略せず表示します。各行の「比較」でつながりを詳しく見られます。</p>
    <div className={styles.overviewScroll}><table><thead><tr><th>因数</th>{ideas.map((idea, i) => <th key={idea.id}>アイデア {i + 1}</th>)}</tr></thead><tbody>{analysis.factors.map(factor => <tr key={factor.id}>
      <th scope="row"><strong>{factor.name}</strong><button type="button" onClick={() => onCompare(factor.id)} aria-label={`${factor.name}を比較`}>比較 ↗</button></th>
      {ideas.map(idea => {
        const value = analysis.values.find(value => value.ideaId === idea.id && value.factorId === factor.id);
        const direct = value && analysis.pairs.some(pair => pair.source === value.id || pair.target === value.id);
        const broader = value && analysis.broaderPairs?.some(pair => pair.source === value.id || pair.target === value.id);
        return <td key={idea.id}><div className={styles.overviewValue}><strong>{value?.label ?? "情報不足"}</strong>{value && <><small>上位：{value.broaderConcept ?? ("broaderConcept" in value ? "未特定" : "再分析で取得")}</small><span className={direct || broader ? styles.linkedTag : styles.independentTag}>{direct ? "具体的な接点あり" : broader ? "上位概念に接点あり" : "共通リンクなし"}</span>{value.inferred && <small>元の値にAIの推測を含む</small>}</>}</div></td>;
      })}
    </tr>)}</tbody></table></div>
  </section>;
}
