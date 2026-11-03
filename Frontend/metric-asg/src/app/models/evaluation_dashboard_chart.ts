
import { EvaluationDashboard } from './evaluation_dashboard';
import { HistoricalTrendDataset } from '../shared/historical-trend-chart/historical-trend-chart.component';

function getTimestamp(date: string | null): number | null {
    if (!date) {
        return null;
    }

    const timestamp = new Date(date).getTime();

    return Number.isFinite(timestamp) ? timestamp : null;
}

export interface HistoricalDashboardChart {
    labels: string[];
    datasets: HistoricalTrendDataset[];
}

export function buildHistoricalChart(
    dashboard: EvaluationDashboard,
    ambitId?: number
): HistoricalDashboardChart {
    const evaluations = dashboard.history;

    const labels = evaluations.map(evaluation => {
        if (!evaluation.date) {
            return 'Sin fecha';
        }

        const date = new Date(evaluation.date);

        return Number.isNaN(date.getTime())
            ? 'Fecha inválida'
            : date.toLocaleDateString('es-MX');
    });

    const methodologyIds = [
        ...new Set(evaluations.map(evaluation => evaluation.methodology_id))
    ];

    const colors = [
        '#00245D',
        '#008C95',
        '#9B59B6',
        '#E67E22',
        '#C0392B'
    ];

    const datasets: HistoricalTrendDataset[] = methodologyIds.map(
        (methodologyId, index) => {
            const methodology = evaluations.find(
                evaluation => evaluation.methodology_id === methodologyId
            );

            return {
                label: `Metodología ${methodology?.methodology_version ?? methodologyId}`,
                color: colors[index % colors.length],
                data: evaluations
                    .filter(evaluation => evaluation.methodology_id === methodologyId)
                    .map(evaluation => {
                        const timestamp = getTimestamp(evaluation.date);

                        if (timestamp === null) {
                            return null;
                        }

                        const score = ambitId === undefined
                            ? evaluation.global_score
                            : evaluation.ambits.find(
                                ambit => ambit.ambit_id === ambitId
                            )?.score ?? null;

                        return {
                            x: timestamp,
                            y: score
                        };
                    })
                    .filter(point => point !== null)
            };
        }
    );

    return { labels, datasets };
}
