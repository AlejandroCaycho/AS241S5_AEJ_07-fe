import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { IA_ENDPOINTS } from '../../../core/config/api.config';
import { IAResponse } from '../../../models/ia-response.model';
import { PromptRequest } from '../../../models/prompt-request.model';

@Injectable({
  providedIn: 'root',
})
export class IAService {
  private readonly http = inject(HttpClient);

  procesar(prompt: string): Observable<IAResponse[]> {
    const body: PromptRequest = { prompt };
    return this.http.post<IAResponse[]>(IA_ENDPOINTS.process, body);
  }

  obtenerHistorial(): Observable<IAResponse[]> {
    return this.http.get<IAResponse[]>(IA_ENDPOINTS.history);
  }

  obtenerHistorialPorFuente(source: string): Observable<IAResponse[]> {
    return this.http.get<IAResponse[]>(IA_ENDPOINTS.historyBySource(source));
  }

  actualizarPrompt(id: number, prompt: string): Observable<IAResponse[]> {
    const body: PromptRequest = { prompt };
    return this.http.put<IAResponse[]>(IA_ENDPOINTS.historyById(id), body);
  }

  eliminarPorId(id: number): Observable<void> {
    return this.http.delete<void>(IA_ENDPOINTS.historyById(id));
  }

  eliminarTodo(): Observable<void> {
    return this.http.delete<void>(IA_ENDPOINTS.deleteAll);
  }
}
