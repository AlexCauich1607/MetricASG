
import { buildHistoricalChart } from './evaluation_dashboard_chart';
import { EvaluationDashboard } from './evaluation_dashboard';

describe('buildHistoricalChart', () => {
    const dashboard: EvaluationDashboard = {
        history: [
            {
                evaluation_id: 1,
                date: '2026-01-15',
                methodology_id: 1,
                methodology_version: '1.0',
                global_score: 7,
                global_delta: null,
                ambits: [
                    {
                        ambit_id: 1,
                        ambit_name: 'Ambiental',
                        score: 6,
                        delta: null
                    }
                ]
            },
            {
                evaluation_id: 2,
                date: '2026-02-15',
                methodology_id: 1,
                methodology_version: '1.0',
                global_score: 8,
                global_delta: 1,
                ambits: [
                    {
                        ambit_id: 1,
                        ambit_name: 'Ambiental',
                        score: 7,
                        delta: 1
                    }
                ]
            },
            {
                evaluation_id: 3,
                date: '2026-03-15',
                methodology_id: 2,
                methodology_version: '2.0',
                global_score: 9,
                global_delta: null,
                ambits: [
                    {
                        ambit_id: 1,
                        ambit_name: 'Ambiental',
                        score: 8,
                        delta: null
                    }
                ]
            }
        ]
    };

    it('separa las puntuaciones globales por metodología', () => {
        const result = buildHistoricalChart(dashboard);

        expect(result.labels.length).toBe(3);
        expect(result.datasets.length).toBe(2);
        expect(result.datasets[0].data).toEqual([
            { x: new Date('2026-01-15').getTime(), y: 7 },
            { x: new Date('2026-02-15').getTime(), y: 8 }
        ]);

        expect(result.datasets[1].data).toEqual([
            { x: new Date('2026-03-15').getTime(), y: 9 }
        ]);
    });

    it('obtiene las puntuaciones de un ámbito específico', () => {
        const result = buildHistoricalChart(dashboard, 1);

        expect(result.datasets[0].data.map(point => point.y)).toEqual([6, 7]);
        expect(result.datasets[1].data.map(point => point.y)).toEqual([8]);
    });

    it('conserva las puntuaciones nulas', () => {
        const data: EvaluationDashboard = {
            history: [
                {
                    ...dashboard.history[0],
                    global_score: null
                }
            ]
        };

        const result = buildHistoricalChart(data);

        expect(result.datasets[0].data).toEqual([
            { x: new Date('2026-01-15').getTime(), y: null }
        ]);
    });

    it('devuelve datasets vacíos cuando no hay evaluaciones', () => {
        const result = buildHistoricalChart({ history: [] });

        expect(result.labels).toEqual([]);
        expect(result.datasets).toEqual([]);
    });
    it('formatea correctamente fechas ISO con hora', () => {
        const data: EvaluationDashboard = {
            history: [
                {
                    ...dashboard.history[0],
                    date: '2026-11-02T17:30:00'
                }
            ]
        };

        const result = buildHistoricalChart(data);

        expect(result.labels).toEqual(['2/11/2026']);
    });
});
