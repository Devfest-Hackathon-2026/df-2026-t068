import { cosine } from './math.ts';

export function canonicalLabel(text: string): string {
  return text.normalize('NFKC').trim().replace(/\s+/gu, ' ');
}

// A centroid-only nearest neighbour can be close to the midpoint but too far
// from one member. Check both members before preferring a generated term.
export function rankLabels(labels: string[], vectors: number[][], members: number[][], centroid: number[], minimumCentroid: number, minimumMember: number) {
  return labels.map((label, i) => {
    const vector = vectors[i];
    const score = cosine(centroid, vector);
    const memberScore = Math.min(...members.map(m => cosine(m, vector)));
    return { label, score, memberScore, eligible: score >= minimumCentroid && memberScore >= minimumMember, vector };
  }).sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.memberScore - a.memberScore || b.score - a.score || a.label.localeCompare(b.label));
}
