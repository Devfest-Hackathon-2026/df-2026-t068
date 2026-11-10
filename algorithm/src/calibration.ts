import type { Analysis } from './types.ts';
export type Judgment = { source:string; target:string; factorId:string; level:'direct'|'broader'; expected:boolean };
// Read saved scores and human judgments only. This module never calls a provider.
export function calibrate(analysis:Analysis, judgments:Judgment[]) {
  const groups = new Map<string,{score:number; expected:boolean}[]>();
  const seen = new Set<string>();
  for (const judgment of judgments) {
    if (!['direct','broader'].includes(judgment.level) || typeof judgment.expected!=='boolean' || judgment.source===judgment.target) throw Error('Invalid judgment');
    const key=JSON.stringify([judgment.factorId,judgment.level]);
    const pairKey=JSON.stringify([key,[judgment.source,judgment.target].sort()]);
    if (seen.has(pairKey)) throw Error('Duplicate judgment');
    seen.add(pairKey);
    const pairs=judgment.level==='broader'?analysis.broaderComparisons??[]:analysis.comparisons;
    const pair=pairs.find(pair=>pair.factorId===judgment.factorId && ((pair.source===judgment.source&&pair.target===judgment.target)||(pair.target===judgment.source&&pair.source===judgment.target)));
    if (!pair || !Number.isFinite(pair.score) || pair.score < -1 || pair.score > 1) throw Error('No saved score for judgment');
    const rows=groups.get(key)??[];rows.push({score:pair.score,expected:judgment.expected});groups.set(key,rows);
  }
  return [...groups].map(([key,rows])=>{
    const [factorId,level]=JSON.parse(key) as [string,string];
    const positives=rows.filter(row=>row.expected).length;
    if (!positives || positives===rows.length) return {factorId,level,count:rows.length,recommendation:null,reason:'Need both positive and negative examples'};
    const candidates=[...new Set([-1,1,...rows.map(row=>row.score)])].map(threshold=>{
      const tp=rows.filter(row=>row.expected&&row.score>=threshold).length;
      const fp=rows.filter(row=>!row.expected&&row.score>=threshold).length;
      const precision=tp+fp?tp/(tp+fp):0,recall=tp/positives;
      return {threshold,precision,recall,f1:precision+recall?2*precision*recall/(precision+recall):0};
    }).sort((a,b)=>b.f1-a.f1||b.precision-a.precision||b.threshold-a.threshold);
    return {factorId,level,count:rows.length,recommendation:candidates[0],reason:'Training examples only; validate on separate held-out examples before changing defaults'};
  });
}
