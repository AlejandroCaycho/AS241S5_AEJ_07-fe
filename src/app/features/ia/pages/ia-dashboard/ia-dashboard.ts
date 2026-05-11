import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { forkJoin, finalize } from 'rxjs';

import { ApiError } from '../../../../models/api-error.model';
import { IAResponse } from '../../../../models/ia-response.model';
import { IAService } from '../../services/ia.service';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';

type SourceFilter = 'all' | 'openrouter' | 'mistral';

interface HistoryThread {
  id: number;
  prompt: string;
  fecha: string;
  responses: IAResponse[];
}

@Component({
  selector: 'app-ia-dashboard',
  imports: [CommonModule, ReactiveFormsModule, MarkdownPipe],
  templateUrl: './ia-dashboard.html',
  styleUrl: './ia-dashboard.scss',
})
export class IADashboard {
  private readonly formBuilder = inject(NonNullableFormBuilder);
  private readonly iaService = inject(IAService);

  readonly isProcessing = signal(false);
  readonly isLoadingHistory = signal(false);
  readonly results = signal<IAResponse[]>([]);
  readonly history = signal<IAResponse[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly selectedSource = signal<SourceFilter>('all');
  readonly selectedHistoryId = signal<number | null>(null);
  readonly submitted = signal(false);

  readonly editingThread = signal<HistoryThread | null>(null);
  readonly editPromptValue = signal('');
  readonly isUpdating = signal(false);
  readonly isDeletingId = signal<number | null>(null);
  readonly showDeleteAllConfirm = signal(false);

  readonly isGeneratingInsight = signal(false);
  readonly insightResult = signal<IAResponse[]>([]);
  readonly showInsightPanel = signal(false);

  private readonly isNewChat = signal(false);

  readonly promptForm = this.formBuilder.group({
    prompt: ['', [Validators.required, Validators.minLength(3)]],
  });

  readonly historyTitle = computed(() => {
    const source = this.selectedSource();
    return source === 'all' ? 'Historial completo' : `Historial de ${source}`;
  });

  readonly visibleResults = computed(() => this.results().slice(0, 2));

  readonly visibleHistory = computed(() => {
    const source = this.selectedSource();
    const filtered =
      source === 'all'
        ? this.history()
        : this.history().filter((r) => r.source === source);

    const groups = new Map<string, IAResponse[]>();
    for (const response of filtered) {
      const key = this.cleanText(response.prompt).toLowerCase();
      groups.set(key, [...(groups.get(key) ?? []), response]);
    }

    return Array.from(groups.values()).map((responses) =>
      this.createThread(responses),
    );
  });

  readonly selectedHistory = computed(() => {
    const history = this.visibleHistory();
    const selectedId = this.selectedHistoryId();
    return (
      history.find((thread) =>
        thread.responses.some((response) => response.id === selectedId),
      ) ??
      history[0] ??
      null
    );
  });

  readonly responseCount = computed(() => this.history().length);
  readonly openRouterCount = computed(
    () => this.history().filter((item) => item.source === 'openrouter').length,
  );
  readonly mistralCount = computed(
    () => this.history().filter((item) => item.source === 'mistral').length,
  );

  readonly activeResponses = computed(() => {
    if (this.visibleResults().length > 0) return this.visibleResults();
    if (this.isNewChat()) return [];
    return this.selectedHistory()?.responses ?? [];
  });

  readonly activePrompt = computed(() => {
    if (this.visibleResults().length > 0) return this.visibleResults()[0].prompt;
    if (this.isNewChat()) return '';
    return this.selectedHistory()?.prompt ?? '';
  });

  constructor() {
    this.loadHistory();
  }

  processPrompt(): void {
    if (this.promptForm.invalid || this.isProcessing()) {
      this.promptForm.markAllAsTouched();
      this.submitted.set(true);
      return;
    }

    this.errorMessage.set(null);
    this.isProcessing.set(true);
    this.submitted.set(true);
    this.isNewChat.set(false);
    this.insightResult.set([]);
    this.showInsightPanel.set(false);

    this.iaService
      .procesar(this.promptForm.controls.prompt.value.trim())
      .pipe(finalize(() => this.isProcessing.set(false)))
      .subscribe({
        next: (responses) => {
          this.results.set(responses);
          this.selectedHistoryId.set(responses[0]?.id ?? null);
          this.promptForm.reset();
          this.submitted.set(false);
          this.loadHistory();
        },
        error: (error: ApiError) => {
          this.errorMessage.set(error.message);
          this.submitted.set(false);
        },
      });
  }

  onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      event.preventDefault();
      this.processPrompt();
    }
  }

  loadHistory(): void {
    this.errorMessage.set(null);
    this.isLoadingHistory.set(true);

    this.iaService
      .obtenerHistorial()
      .pipe(finalize(() => this.isLoadingHistory.set(false)))
      .subscribe({
        next: (responses) => {
          this.history.set(responses);
          if (
            !this.isNewChat() &&
            !responses.some((item) => item.id === this.selectedHistoryId())
          ) {
            this.selectedHistoryId.set(this.visibleHistory()[0]?.id ?? null);
          }
          this.isNewChat.set(false);
        },
        error: (error: ApiError) => {
          this.isNewChat.set(false);
          this.errorMessage.set(error.message);
        },
      });
  }

  openEditModal(thread: HistoryThread, event: Event): void {
    event.stopPropagation();
    this.editingThread.set(thread);
    this.editPromptValue.set(thread.prompt);
  }

  cancelarEdicion(): void {
    this.editingThread.set(null);
    this.editPromptValue.set('');
  }

  newChat(): void {
    this.isNewChat.set(true);
    this.results.set([]);
    this.selectedHistoryId.set(null);
    this.insightResult.set([]);
    this.showInsightPanel.set(false);
    this.promptForm.reset();
    this.submitted.set(false);
    this.errorMessage.set(null);
  }

  confirmarActualizacion(): void {
    const thread = this.editingThread();
    const newPrompt = this.editPromptValue().trim();
    if (!thread || newPrompt.length < 3 || this.isUpdating()) return;

    this.isUpdating.set(true);
    this.errorMessage.set(null);

    this.iaService
      .actualizarPrompt(thread.id, newPrompt)
      .pipe(finalize(() => this.isUpdating.set(false)))
      .subscribe({
        next: (responses) => {
          // 1. Identificar IDs a eliminar (los del hilo antiguo)
          const oldIds = thread.responses.map((r) => r.id);

          // 2. Actualizar estado local inmediatamente para evitar saltos en la UI
          this.history.update((current) => [
            ...current.filter((r) => !oldIds.includes(r.id)),
            ...responses,
          ]);

          this.results.set(responses);
          this.selectedHistoryId.set(responses[0]?.id ?? null);
          this.insightResult.set([]);
          this.showInsightPanel.set(false);
          this.cancelarEdicion();

          // 3. Eliminar del backend de forma definitiva SOLO si son IDs distintos
          // (Evita borrar lo que el backend pudo haber actualizado en lugar de clonar)
          const newIds = responses.map((r) => r.id);
          const idsToDelete = oldIds.filter((id) => !newIds.includes(id));

          if (idsToDelete.length > 0) {
            const deletes = idsToDelete.map((id) => this.iaService.eliminarPorId(id));
            forkJoin(deletes).subscribe({
              error: (err) => console.error('Error al limpiar consulta previa:', err),
            });
          }
        },
        error: (error: ApiError) => {
          this.errorMessage.set(error.message);
        },
      });
  }

  eliminarThread(thread: HistoryThread, event: Event): void {
    event.stopPropagation();
    this.isDeletingId.set(thread.id);
    this.errorMessage.set(null);

    const deletes = thread.responses.map((r) =>
      this.iaService.eliminarPorId(r.id),
    );

    forkJoin(deletes)
      .pipe(finalize(() => this.isDeletingId.set(null)))
      .subscribe({
        next: () => {
          if (thread.responses.some((r) => r.id === this.selectedHistoryId())) {
            this.selectedHistoryId.set(null);
            this.results.set([]);
            this.insightResult.set([]);
            this.showInsightPanel.set(false);
          }
          this.loadHistory();
        },
        error: (error: ApiError) => this.errorMessage.set(error.message),
      });
  }

  confirmarEliminarTodo(): void {
    this.showDeleteAllConfirm.set(false);
    this.errorMessage.set(null);

    this.iaService.eliminarTodo().subscribe({
      next: () => {
        this.history.set([]);
        this.results.set([]);
        this.selectedHistoryId.set(null);
        this.insightResult.set([]);
        this.showInsightPanel.set(false);
      },
      error: (error: ApiError) => this.errorMessage.set(error.message),
    });
  }

  generateInsight(): void {
    const responses = this.activeResponses();
    if (responses.length < 2 || this.isGeneratingInsight()) return;

    const [a, b] = responses;
    const insightPrompt =
      `Analiza y compara estas dos respuestas de IA sobre el tema: "${this.cleanText(a.prompt)}". ` +
      `Respuesta A (${this.sourceLabel(a.source)} – ${a.model}): ${this.cleanText(a.respuestaIa).slice(0, 600)}... ` +
      `Respuesta B (${this.sourceLabel(b.source)} – ${b.model}): ${this.cleanText(b.respuestaIa).slice(0, 600)}... ` +
      `Determina: 1) Cual es mas precisa y por que. 2) Que informacion aporta cada una que la otra omite. ` +
      `3) Una conclusion sintetica con la mejor respuesta combinada. Se conciso.`;

    this.isGeneratingInsight.set(true);
    this.errorMessage.set(null);

    this.iaService
      .procesar(insightPrompt)
      .pipe(finalize(() => this.isGeneratingInsight.set(false)))
      .subscribe({
        next: (responses) => {
          this.insightResult.set(responses);
          this.showInsightPanel.set(true);
          this.loadHistory();
        },
        error: (error: ApiError) => this.errorMessage.set(error.message),
      });
  }

  closeInsightPanel(): void {
    this.showInsightPanel.set(false);
    this.insightResult.set([]);
  }

  trackResponse(_: number, response: IAResponse): number {
    return response.id;
  }

  trackThread(_: number, thread: HistoryThread): number {
    return thread.id;
  }

  usePrompt(prompt: string): void {
    this.promptForm.controls.prompt.setValue(prompt);
    this.promptForm.controls.prompt.markAsDirty();
  }

  sourceLabel(source: string): string {
    const labels: Record<string, string> = {
      openrouter: 'OpenRouter',
      mistral: 'Mistral',
    };
    return labels[source] ?? source;
  }

  sourceClass(source: string): string {
    return source === 'mistral' ? 'source-pill--mistral' : 'source-pill--openrouter';
  }

  cleanText(value: string): string {
    return value.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
  }

  selectHistory(thread: HistoryThread): void {
    this.isNewChat.set(false);
    this.results.set([]);
    this.selectedHistoryId.set(thread.id);
    this.insightResult.set([]);
    this.showInsightPanel.set(false);
  }

  isSelected(thread: HistoryThread): boolean {
    const selectedId = this.selectedHistoryId();
    const isThreadSelected = thread.responses.some((r) => r.id === selectedId);
    return isThreadSelected && !this.isNewChat();
  }

  isDeletingThread(thread: HistoryThread): boolean {
    return this.isDeletingId() === thread.id;
  }

  private createThread(responses: IAResponse[]): HistoryThread {
    const [first] = responses;
    return {
      id: first.id,
      prompt: first.prompt,
      fecha: first.fecha,
      responses,
    };
  }
}