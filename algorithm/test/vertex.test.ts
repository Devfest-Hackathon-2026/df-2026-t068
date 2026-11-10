import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { VertexProvider } from '../src/vertex.ts';
import { GenerateContentResponse } from '@google/genai';
import type { Config } from '../src/types.ts';
const options = { project: 'idea-wave-513901', location: 'global', generationModel: 'test-generation', embeddingModel: 'test-embedding' };
test('Vertex uses SDK structured output and maps embedding response', async () => {
  const config: Config = JSON.parse(await readFile(new URL('../config/default.json', import.meta.url), 'utf8'));
  const p = new VertexProvider(options, {
    generateContent: async request => {
      assert.equal(request.model, options.generationModel);
      assert.ok(request.config?.responseJsonSchema);
      assert.ok(request.config?.systemInstruction);
      const response = new GenerateContentResponse();
      response.candidates = [{ content: { parts: [{ text: '{"values":[]}' }] } }];
      return response;
    },
    embedContent: async request => {
      assert.equal(request.model, options.embeddingModel);
      return { embeddings: [{ values: [1, 0] }] };
    }
  });
  assert.deepEqual(await p.extract({ id: 'a', text: 'example' }, config), { values: [] });
  assert.deepEqual(await p.embed(['example']), [[1, 0]]);
});
test('Vertex rejects missing settings and hides sensitive SDK errors', async () => {
  assert.throws(() => new VertexProvider({ ...options, project: '' }));
  const p = new VertexProvider(options, {
    generateContent: async () => { throw new Error('private input'); },
    embedContent: async () => { throw new Error('secret'); }
  });
  await assert.rejects(p.embed(['example']), e => e instanceof Error && e.message.includes('ADC') && !e.message.includes('secret'));
});
