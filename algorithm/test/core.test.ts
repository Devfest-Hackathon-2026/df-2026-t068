import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { analyze, analyzeValues, compareValues, validateExtraction } from '../src/core.ts';
import { cosine, meanVector } from '../src/math.ts';
import { MockProvider } from '../src/mock.ts';
import { GoogleProvider } from '../src/google.ts';
import { formatReport } from '../src/report.ts';
import type { Config, EmbeddedValue } from '../src/types.ts';
const c: Config = JSON.parse(await readFile(new URL('../config/default.json', import.meta.url), 'utf8'));
const ideas = [{ id: 'a', text: '個別最適化' }, { id: 'b', text: 'パーソナライズ' }];
test('cosine and normalized average handle scale and reject invalid vectors', () => {
  assert.equal(cosine([5, 0], [1, 0]), 1);
  assert.deepEqual(meanVector([[10, 0], [0, 2]]), [0.5, 0.5]);
  assert.throws(() => cosine([0], [1]));
  assert.throws(() => cosine([1], [1, 2]));
  assert.throws(() => meanVector([[1], [-1]]));
  assert.throws(() => cosine([NaN], [1]));
});
test('end-to-end fixture selects midpoint label and keeps originals', async () => {
  const result = await analyze(ideas, c, new MockProvider());
  assert.equal(result.pairs.length, 1);
  assert.equal(result.labels[0].label, '個人適応');
  assert.deepEqual(result.values.map(v => v.label), ['個別最適化', 'パーソナライズ']);
  assert.equal(result.labels[0].memberIds.length, 2);
  assert.ok(result.labels[0].candidates[0].score > result.labels[0].candidates[1].score);
});
test('only cross-idea, same-factor values are compared', () => {
  const v = (id: string, ideaId: string, factorId: string): EmbeddedValue => ({ id, ideaId, factorId, label: id, description: '', evidence: '', inferred: true, vector: [1, 0] });
  const result = compareValues([v('1', 'a', 'mechanism'), v('2', 'a', 'mechanism'), v('3', 'b', 'purpose'), v('4', 'b', 'mechanism')], c);
  assert.equal(result.length, 2);
  assert.ok(result.every(p => p.factorId === 'mechanism'));
});
test('threshold and alternative evaluation formula can be changed', async () => {
  assert.equal((await analyze(ideas, { ...c, similarityThreshold: 1 }, new MockProvider())).pairs.length, 0);
  assert.equal((await analyze(ideas, c, new MockProvider(), () => 0)).pairs.length, 0);
});
test('fabricated evidence and unknown factors are rejected', () => {
  const value = { factorId: 'mechanism', label: '支援', description: '', evidence: '存在しない', inferred: false };
  assert.throws(() => validateExtraction({ factors: Object.fromEntries(c.factors.map(f => [f.id, f.id === 'mechanism' ? value.label : null])), details: { mechanism: value } }, ideas[0], c));
  assert.throws(() => validateExtraction({ values: [{ ...value, factorId: 'unknown' }] }, ideas[0], c));
});
test('reanalyze preserves manual IDs and respects dismissed links', async () => {
  const first = await analyze(ideas, c, new MockProvider());
  const second = await analyzeValues(first.values, c, new MockProvider(), undefined, [[first.values[0].id, first.values[1].id]]);
  assert.deepEqual(second.values.map(v => v.id), first.values.map(v => v.id));
  assert.equal(second.pairs.length, 0);
});
test('bad embeddings and invalid configuration fail early', async () => {
  const p = new MockProvider(); p.embed = async () => [[1, 0]];
  await assert.rejects(analyze(ideas, c, p), /count/);
  await assert.rejects(analyze(ideas, { ...c, similarityThreshold: NaN }, p));
  await assert.rejects(analyze([ideas[0], ideas[0]], c, p));
});
test('live adapter emits schema, uses key header, and parses fake REST responses', async () => {
  const requests: { url: string; body: any }[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal((init?.headers as Record<string, string>)['x-goog-api-key'], 'test-key');
    assert.ok(!String(url).includes('test-key'));
    requests.push({ url: String(url), body: JSON.parse(init?.body as string) });
    const payload = String(url).endsWith(':embedContent') ? { embedding: { values: [1, 0] } } : { candidates: [{ content: { parts: [{ text: '{"values":[]}' }] } }] };
    return new Response(JSON.stringify(payload));
  };
  const p = new GoogleProvider({ apiKey: 'test-key', generationModel: 'test-gen', embeddingModel: 'test-embed', fetcher });
  assert.deepEqual(await p.extract(ideas[0], c), { values: [] });
  assert.deepEqual(await p.embed(['a']), [[1, 0]]);
  assert.ok(requests[0].body.generationConfig.responseJsonSchema);
});
test('HTTP errors do not expose API body', async () => {
  const p = new GoogleProvider({ apiKey: 'secret', generationModel: 'gen', embeddingModel: 'emb', fetcher: async () => new Response('secret', { status: 429 }) });
  await assert.rejects(p.embed(['a']), e => e instanceof Error && e.message.includes('429') && !e.message.includes('secret'));
});
test('factor output accepts scalar/null and rejects arrays and missing factors', async () => {
  const raw = await new MockProvider().extract(ideas[0], c) as any;
  const values = validateExtraction(raw, ideas[0], c);
  assert.equal(values.length, 1);
  assert.equal(values[0].factorId, 'mechanism');
  assert.throws(() => validateExtraction({ ...raw, factors: { ...raw.factors, mechanism: ['a', 'b'] } }, ideas[0], c));
  const missing = { ...raw.factors }; delete missing.target;
  assert.throws(() => validateExtraction({ ...raw, factors: missing }, ideas[0], c));
});
test('report shows below-threshold scores and null values; nulls are never embedded', async () => {
  const result = await analyze(ideas, { ...c, similarityThreshold: 1 }, new MockProvider());
  assert.equal(result.comparisons.length, 1);
  assert.equal(result.pairs.length, 0);
  assert.equal(result.values.length, 2);
  assert.equal(result.decompositions?.[0].factors.target, null);
  assert.equal(typeof result.decompositions?.[0].factors.mechanism, 'string');
  const report = formatReport(result, ideas, { ...c, similarityThreshold: 1 });
  assert.ok(report.includes('しきい値未満'));
  assert.ok(report.includes('情報不足'));
});
