import { GoogleProvider } from './google.ts';
import { VertexProvider } from './vertex.ts';
import { MockProvider } from './mock.ts';
export function createProvider(mock = false) {
  if (mock) return new MockProvider();
  const backend = process.env.GOOGLE_AI_BACKEND ?? 'vertex';
  const models = { generationModel: process.env.GEMINI_GENERATION_MODEL ?? '', embeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? '' };
  if (backend === 'vertex') return new VertexProvider({ project: process.env.GOOGLE_CLOUD_PROJECT ?? '', location: process.env.GOOGLE_CLOUD_LOCATION ?? '', ...models });
  if (backend === 'developer') return new GoogleProvider({ apiKey: process.env.GEMINI_API_KEY ?? '', ...models });
  throw new Error('GOOGLE_AI_BACKEND must be vertex or developer');
}
