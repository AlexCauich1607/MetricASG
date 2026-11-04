import {
  Component,
  ChangeDetectionStrategy,
  Input
} from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { AsgReport } from '../../models/asg_report';
import { EvaluationComparisonResult } from '../../models/evaluation_comparison';
import {
  ImprovementPriority,
  ImprovementStatus
} from '../../models/improvement_action';

@Component({
  selector: 'app-asg-report-template',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './asg-report-template.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './asg-report-template.component.scss'
})
export class AsgReportTemplateComponent {
  @Input({ required: true }) report!: AsgReport;
  getComparisonAmbitScore(
    evaluation: EvaluationComparisonResult | undefined,
    ambitId: number
  ): number | null {
    return evaluation?.ambits.find(
      ambit => ambit.ambit_id === ambitId
    )?.score ?? null;
  }
  getPriorityLabel(priority: ImprovementPriority): string {
    const labels: Record<ImprovementPriority, string> = {
      LOW: 'Baja',
      MEDIUM: 'Media',
      HIGH: 'Alta'
    };

    return labels[priority];
  }

  getStatusLabel(status: ImprovementStatus): string {
    const labels: Record<ImprovementStatus, string> = {
      PENDING: 'Pendiente',
      IN_PROGRESS: 'En progreso',
      COMPLETED: 'Completada',
      CANCELLED: 'Cancelada'
    };

    return labels[status];
  }
}