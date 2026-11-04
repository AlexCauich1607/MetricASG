import { Injectable } from '@angular/core';
import {
    forkJoin,
    map,
    Observable,
    switchMap,
    of
} from 'rxjs';

import { EvaluationComparison } from '../models/evaluation_comparison';
import { EvaluationService } from './evaluation.service';
import { ImprovementActionService } from './improvement-action.service';
import { UserService } from './user.service';

import { AsgReport } from '../models/asg_report';
import { EvaluationHistory } from '../models/history_evaluations';

@Injectable({
    providedIn: 'root'
})
export class AsgReportService {

    constructor(
        private evaluationService: EvaluationService,
        private improvementActionService: ImprovementActionService,
        private userService: UserService
    ) { }

    getReport(evaluationId: number): Observable<AsgReport> {
        return forkJoin({
            company: this.userService.getMe(),
            evaluation: this.evaluationService.getEvaluationResultById(
                evaluationId
            ),
            history: this.evaluationService.getEvaluationHistory(),
            improvement_actions: this.improvementActionService.getActions(
                evaluationId
            ),
            improvement_progress:
                this.improvementActionService.getProgressMetrics(evaluationId)
        }).pipe(
            switchMap(data => {
                const previousEvaluationId = this.getPreviousEvaluationId(
                    data.history,
                    evaluationId
                );

                const comparison$: Observable<EvaluationComparison | null> =
                    previousEvaluationId !== null
                        ? this.evaluationService.getEvaluationComparison(
                            previousEvaluationId,
                            evaluationId
                        )
                        : of(null);

                return comparison$.pipe(
                    map((comparison): AsgReport => ({
                        company: data.company,
                        evaluation: data.evaluation,
                        comparison,
                        improvement_actions: data.improvement_actions,
                        improvement_progress: data.improvement_progress
                    }))
                );
            })
        );
    }

    private getPreviousEvaluationId(
        history: EvaluationHistory,
        evaluationId: number
    ): number | null {
        const evaluations = [...history.history].sort(
            (a, b) =>
                a.date.localeCompare(b.date) ||
                a.evaluation_id - b.evaluation_id
        );

        const currentIndex = evaluations.findIndex(
            evaluation => evaluation.evaluation_id === evaluationId
        );

        if (currentIndex <= 0) {
            return null;
        }

        return evaluations[currentIndex - 1].evaluation_id;
    }
}