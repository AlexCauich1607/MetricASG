import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  signal
} from '@angular/core';

import { HttpErrorResponse } from '@angular/common/http';
import {
  EvidenceCreateRequest,
  TextEvidenceType
} from '../../../models/evaluation_evidence';
import { EventEmitter, Output } from '@angular/core';
import { EvidenceService } from '../../../services/evidence.service';
import { EvaluationEvidence } from '../../../models/evaluation_evidence';

@Component({
  selector: 'app-evaluation-evidences',
  standalone: true,
  imports: [],
  templateUrl: './evaluation-evidences.component.html',
  styleUrl: './evaluation-evidences.component.scss'
})
export class EvaluationEvidencesComponent implements OnChanges {
  @Input() evaluationId: number | null = null;
  @Input({ required: true }) indicatorId!: number;
  @Input() readonly = false;
  @Input() canEdit = false;
  @Output() operationPending = new EventEmitter<boolean>();

  readonly evidences = signal<EvaluationEvidence[]>([]);
  readonly loading = signal(false);
  readonly loadError = signal(false);

  readonly deletingId = signal<number | null>(null);
  readonly deleteError = signal<string | null>(null);

  private requestVersion = 0;

  readonly evidenceType = signal<TextEvidenceType>('COMMENT');
  readonly evidenceContent = signal('');
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);

  readonly maxEvidences = 5;

  get canCreate(): boolean {
    return (
      !this.readonly &&
      this.canEdit &&
      this.evaluationId !== null &&
      this.evidences().length < this.maxEvidences &&
      !this.loading() &&
      !this.loadError() &&
      !this.saving()
    );
  }

  setEvidenceType(type: TextEvidenceType): void {
    this.evidenceType.set(type);
    this.evidenceContent.set('');
    this.saveError.set(null);
  }

  setEvidenceContent(content: string): void {
    this.evidenceContent.set(content);
    this.saveError.set(null);
  }

  createEvidence(): void {
    if (!this.canCreate || this.evaluationId === null) {
      return;
    }

    const content = this.evidenceContent().trim();
    const type = this.evidenceType();

    if (!content) {
      this.saveError.set('El contenido de la evidencia es obligatorio.');
      return;
    }

    if (type === 'COMMENT' && content.length > 2000) {
      this.saveError.set('El comentario no puede superar 2000 caracteres.');
      return;
    }

    if (type === 'URL') {
      if (content.length > 2048) {
        this.saveError.set('El enlace no puede superar 2048 caracteres.');
        return;
      }

      try {
        const url = new URL(content);

        if (url.protocol !== 'https:' || !url.hostname) {
          throw new Error('Invalid URL');
        }
      } catch {
        this.saveError.set('Introduce un enlace HTTPS válido.');
        return;
      }
    }

    const evaluationId = this.evaluationId;
    const indicatorId = this.indicatorId;
    const requestVersion = this.requestVersion;

    const payload: EvidenceCreateRequest = {
      indicator_id: indicatorId,
      type,
      content
    };

    this.saving.set(true);
    this.saveError.set(null);
    this.operationPending.emit(true);

    this.evidenceService.createEvidence(
      evaluationId,
      payload
    )
      .subscribe({
        next: evidence => {
          this.operationPending.emit(false);
          if (
            this.requestVersion !== requestVersion ||
            this.evaluationId !== evaluationId ||
            this.indicatorId !== indicatorId
          ) {
            return;
          }

          this.saving.set(false);
          this.evidences.update(items => [...items, evidence]);
          this.evidenceContent.set('');
        },
        error: (error: HttpErrorResponse) => {
          this.operationPending.emit(false);
          if (
            this.requestVersion !== requestVersion ||
            this.evaluationId !== evaluationId ||
            this.indicatorId !== indicatorId
          ) {
            return;
          }
          this.saving.set(false);

          if (error.status === 409) {
            this.saveError.set(
              'No es posible agregar más evidencias o la evaluación ya está finalizada.'
            );
          } else {
            this.saveError.set(
              'No se pudo guardar la evidencia. Inténtalo nuevamente.'
            );
          }
        }
      });

  }


  deleteEvidence(evidence: EvaluationEvidence): void {
    if (
      this.readonly ||
      !this.canEdit ||
      this.evaluationId === null ||
      this.saving() ||
      this.deletingId() !== null ||
      evidence.type === 'FILE'
    ) {
      return;
    }

    if (!confirm('¿Deseas eliminar esta evidencia?')) {
      return;
    }

    const evaluationId = this.evaluationId;
    const indicatorId = this.indicatorId;
    const requestVersion = this.requestVersion;

    this.deletingId.set(evidence.id);
    this.deleteError.set(null);
    this.operationPending.emit(true);

    this.evidenceService.deleteEvidence(
      evaluationId,
      evidence.id
    )
      .subscribe({
        next: () => {
          this.operationPending.emit(false);
          if (
            this.requestVersion !== requestVersion ||
            this.evaluationId !== evaluationId ||
            this.indicatorId !== indicatorId
          ) {
            return;
          }

          this.deletingId.set(null);


          this.evidences.update(items =>
            items.filter(item => item.id !== evidence.id)
          );
        },
        error: () => {
          this.operationPending.emit(false);
          if (
            this.requestVersion !== requestVersion ||
            this.evaluationId !== evaluationId ||
            this.indicatorId !== indicatorId
          ) {
            return;
          }

          this.deletingId.set(null);

          this.deleteError.set(
            'No se pudo eliminar la evidencia. Inténtalo nuevamente.'
          );
        }
      });

  }


  constructor(private evidenceService: EvidenceService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['evaluationId'] ||
      changes['indicatorId']
    ) {
      this.loadEvidences();
    }
  }

  loadEvidences(): void {
    const version = ++this.requestVersion;

    this.evidences.set([]);
    this.loadError.set(false);

    this.saving.set(false);
    this.deletingId.set(null);
    this.saveError.set(null);
    this.deleteError.set(null);
    this.evidenceContent.set('');

    if (this.evaluationId === null || !this.indicatorId) {
      this.loading.set(false);
      return;
    }

    this.loading.set(true);

    this.evidenceService.getEvidences(
      this.evaluationId,
      this.indicatorId
    ).subscribe({
      next: evidences => {
        if (version !== this.requestVersion) {
          return;
        }

        this.evidences.set(evidences);
        this.loading.set(false);
      },
      error: () => {
        if (version !== this.requestVersion) {
          return;
        }

        this.loadError.set(true);
        this.loading.set(false);
      }
    });
  }
}
