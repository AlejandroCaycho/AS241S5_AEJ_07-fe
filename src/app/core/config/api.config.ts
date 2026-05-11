import { environment } from '../../../environments/environment';

export const API_BASE_URL = environment.apiUrl;

export const IA_ENDPOINTS = {
  process: `${API_BASE_URL}/ia/procesar`,
  history: `${API_BASE_URL}/ia/historial`,
  historyBySource: (source: string) => `${API_BASE_URL}/ia/historial/fuente/${source}`,
  historyById: (id: number) => `${API_BASE_URL}/ia/historial/${id}`,
  deleteAll: `${API_BASE_URL}/ia/historial`,
} as const;
