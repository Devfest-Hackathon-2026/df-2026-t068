import { GoogleGenAI } from '@google/genai';
import { StructuredProvider } from './google.ts';
import type { Provider } from './types.ts';

export interface VertexOptions { project: string; location: string; generationModel: string; embeddingModel: string }
type ModelClient = Pick<GoogleGenAI['models'], 'generateContent' | 'embedContent'>;

// Agent Platform (formerly Vertex AI). Uses ADC, never an AI Studio API key.
export class VertexProvider extends StructuredProvider {
  metadata: Provider['metadata'];
  private models: ModelClient;
  constructor(options: VertexOptions, models?: ModelClient) {
    super();
    if (Object.values(options).some(v => typeof v !== 'string' || !v.trim())) throw new Error('Set Cloud project, location, and both model names');
    this.metadata = { mode: 'vertex-adc', generationModel: options.generationModel, embeddingModel: options.embeddingModel };
    this.models = models ?? new GoogleGenAI({ vertexai: true, project: options.project, location: options.location, httpOptions: { timeout: 60000 } }).models;
  }
  protected async call(model: string, method: string, body: any): Promise<any> {
    try {
      if (method === 'generateContent') return await this.models.generateContent({ model, contents: body.contents, config: { ...body.generationConfig, systemInstruction: body.systemInstruction } });
      if (method === 'embedContent') {
        const response = await this.models.embedContent({ model, contents: body.content });
        return { embedding: { values: response.embeddings?.[0]?.values } };
      }
      throw new Error('Unsupported model operation');
    } catch {
      // SDK errors may contain full request data. Keep user-facing errors generic.
      throw new Error(`Cloud ${method} failed. Check ADC login, IAM permissions, API activation, model availability and location.`);
    }
  }
}
