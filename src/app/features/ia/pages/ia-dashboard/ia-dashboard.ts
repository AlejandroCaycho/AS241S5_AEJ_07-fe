import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

import { ApiError } from '../../../../models/api-error.model';
import { IAResponse } from '../../../../models/ia-response.model';
import { IAService } from '../../services/ia.service';

type SourceFilter = 'all' | 'openrouter' | 'mistral';

@Component({
  selector: 'app-ia-dashboard',
  imports: [CommonModule, ReactiveFormsModule],
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

  readonly promptForm = this.formBuilder.group({
    prompt: ['', [Validators.required, Validators.minLength(3)]],
  });

  readonly historyTitle = computed(() => {
    const source = this.selectedSource();
    return source === 'all' ? 'Historial completo' : `Historial de ${source}`;
  });
  readonly visibleResults = computed(() => this.results().slice(0, 2));
  readonly visibleHistory = computed(() => this.history());
  readonly selectedHistory = computed(() => {
    const history = this.history();
    const selectedId = this.selectedHistoryId();
    return history.find((item) => item.id === selectedId) ?? history[0] ?? null;
  });
  readonly responseCount = computed(() => this.history().length);
  readonly openRouterCount = computed(
    () => this.history().filter((item) => item.source === 'openrouter').length,
  );
  readonly mistralCount = computed(
    () => this.history().filter((item) => item.source === 'mistral').length,
  );

  constructor() {
    this.loadHistory();
  }

  processPrompt(): void {
    if (this.promptForm.invalid || this.isProcessing()) {
      this.promptForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.isProcessing.set(true);

    this.iaService
      .procesar(this.promptForm.controls.prompt.value.trim())
      .pipe(finalize(() => this.isProcessing.set(false)))
      .subscribe({
        next: (responses) => {
          this.results.set(responses);
          this.selectedHistoryId.set(responses[0]?.id ?? null);
          this.promptForm.reset();
          this.loadHistory(this.selectedSource());
        },
        error: (error: ApiError) => this.errorMessage.set(error.message),
      });
  }

  loadHistory(source: SourceFilter = this.selectedSource()): void {
    this.selectedSource.set(source);
    this.errorMessage.set(null);
    this.isLoadingHistory.set(true);

    const request =
      source === 'all'
        ? this.iaService.obtenerHistorial()
        : this.iaService.obtenerHistorialPorFuente(source);

    request.pipe(finalize(() => this.isLoadingHistory.set(false))).subscribe({
      next: (responses) => {
        this.history.set(responses);

        if (!responses.some((item) => item.id === this.selectedHistoryId())) {
          this.selectedHistoryId.set(responses[0]?.id ?? null);
        }
      },
      error: (error: ApiError) => this.errorMessage.set(error.message),
    });
  }

  trackResponse(_: number, response: IAResponse): number {
    return response.id;
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

  promptLength(): number {
    return this.promptForm.controls.prompt.value.trim().length;
  }

  selectHistory(response: IAResponse): void {
    this.results.set([]);
    this.selectedHistoryId.set(response.id);
  }

  isSelected(response: IAResponse): boolean {
    return this.selectedHistory()?.id === response.id && this.results().length === 0;
  }
}
