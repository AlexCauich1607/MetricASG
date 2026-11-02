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
  @Input() hasAnswer = false;

  readonly isExpanded = signal(false);
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

  readonly selectedFile = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly uploadError = signal<string | null>(null);

  readonly downloadingId = signal<number | null>(null);
  readonly downloadError = signal<string | null>(null);

  readonly maxFileSize = 10 * 1024 * 1024;

  readonly allowedFileTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg'
  ];


  get canCreate(): boolean {
    return (
      !this.readonly &&
      this.canEdit &&
      this.evaluationId !== null &&
      this.evidences().length < this.maxEvidences &&
      !this.loading() &&
      !this.loadError() &&
      !this.saving() &&
      !this.uploading() &&
      this.deletingId() === null
    );
  }


  toggleExpanded(): void {
    if (
      !this.hasAnswer ||
      !this.canEdit ||
      this.saving() ||
      this.uploading() ||
      this.deletingId() !== null
    ) {
      return;
    }

    this.isExpanded.update(expanded => !expanded);
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


  selectFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;

    this.selectedFile.set(null);
    this.uploadError.set(null);

    if (!file) {
      return;
    }

    if (!this.allowedFileTypes.includes(file.type)) {
      this.uploadError.set(
        'Solo se permiten archivos PDF, PNG y JPEG.'
      );
      input.value = '';
      return;
    }

    if (file.size === 0 || file.size > this.maxFileSize) {
      this.uploadError.set(
        'El archivo debe tener un tamaño mayor a 0 y no superar 10 MB.'
      );
      input.value = '';
      return;
    }

    this.selectedFile.set(file);
  }

  downloadEvidence(evidence: EvaluationEvidence): void {
    if (
      this.evaluationId === null ||
      evidence.type !== 'FILE' ||
      this.downloadingId() !== null
    ) {
      return;
    }

    const evaluationId = this.evaluationId;
    const indicatorId = this.indicatorId;
    const requestVersion = this.requestVersion;

    this.downloadingId.set(evidence.id);
    this.downloadError.set(null);

    this.evidenceService.downloadEvidence(
      evaluationId,
      evidence.id
    ).subscribe({
      next: blob => {
        if (
          this.requestVersion !== requestVersion ||
          this.evaluationId !== evaluationId ||
          this.indicatorId !== indicatorId
        ) {
          return;
        }

        this.downloadingId.set(null);

        const objectUrl = URL.createObjectURL(blob);
        const anchor = document.createElement('a');

        anchor.href = objectUrl;
        anchor.download =
          evidence.original_filename || 'evidencia';

        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();

        setTimeout(() => {
          URL.revokeObjectURL(objectUrl);
        }, 1000);
      },
      error: () => {
        if (
          this.requestVersion !== requestVersion ||
          this.evaluationId !== evaluationId ||
          this.indicatorId !== indicatorId
        ) {
          return;
        }

        this.downloadingId.set(null);
        this.downloadError.set(
          'No se pudo descargar el archivo. Inténtalo nuevamente.'
        );
      }
    });
  }

  uploadEvidence(): void {
    if (!this.canCreate || this.evaluationId === null) {
      return;
    }

    const file = this.selectedFile();

    if (!file) {
      this.uploadError.set('Selecciona un archivo.');
      return;
    }

    const evaluationId = this.evaluationId;
    const indicatorId = this.indicatorId;
    const requestVersion = this.requestVersion;

    this.uploading.set(true);
    this.uploadError.set(null);
    this.operationPending.emit(true);

    this.evidenceService.uploadEvidence(
      evaluationId,
      indicatorId,
      file
    ).subscribe({
      next: evidence => {
        this.operationPending.emit(false);

        if (
          this.requestVersion !== requestVersion ||
          this.evaluationId !== evaluationId ||
          this.indicatorId !== indicatorId
        ) {
          return;
        }

        this.uploading.set(false);
        this.selectedFile.set(null);
        this.evidences.update(items => [...items, evidence]);
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

        this.uploading.set(false);

        if (error.status === 409) {
          this.uploadError.set(
            'No es posible agregar más evidencias o la evaluación ya está finalizada.'
          );
        } else if (error.status === 422 || error.status === 413) {
          this.uploadError.set(
            'El archivo no cumple con las restricciones permitidas.'
          );
        } else {
          this.uploadError.set(
            'No se pudo cargar el archivo. Inténtalo nuevamente.'
          );
        }
      }
    });
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
      this.uploading() ||
      this.deletingId() !== null
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
    this.isExpanded.set(false);
    this.evidences.set([]);
    this.loadError.set(false);

    this.saving.set(false);
    this.deletingId.set(null);
    this.saveError.set(null);
    this.deleteError.set(null);
    this.evidenceContent.set('');
    this.uploading.set(false);
    this.selectedFile.set(null);
    this.uploadError.set(null);
    this.downloadingId.set(null);
    this.downloadError.set(null);

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
