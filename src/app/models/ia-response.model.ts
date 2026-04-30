export interface IAResponse {
  id: number;
  source: IAResponseSource;
  model: string;
  prompt: string;
  respuestaIa: string;
  fecha: string;
}

export type IAResponseSource = 'openrouter' | 'mistral' | string;
