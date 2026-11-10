export function validateVector(v: number[]): void {
  if (!Array.isArray(v) || !v.length || v.some(x => !Number.isFinite(x))) throw new Error('Invalid vector');
  if (Math.hypot(...v) === 0) throw new Error('Zero vector');
}
export function normalize(v: number[]): number[] {
  validateVector(v);
  const norm = Math.hypot(...v);
  return v.map(x => x / norm);
}
export function cosine(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vector dimension mismatch');
  const x = normalize(a), y = normalize(b);
  return Math.max(-1, Math.min(1, x.reduce((s, v, i) => s + v * y[i], 0)));
}
// Normalize individual vectors first so their magnitude does not weight the mean.
export function meanVector(vectors: number[][]): number[] {
  if (!vectors.length) throw new Error('Cannot average an empty collection');
  const normalized = vectors.map(normalize);
  if (normalized.some(v => v.length !== normalized[0].length)) throw new Error('Vector dimension mismatch');
  const mean = normalized[0].map((_, i) => normalized.reduce((s, v) => s + v[i], 0) / normalized.length);
  validateVector(mean);
  return mean;
}
