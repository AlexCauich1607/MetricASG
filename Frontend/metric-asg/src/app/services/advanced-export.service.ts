import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { EvaluationHistory } from '../models/history_evaluations';
import { EvaluationComparison } from '../models/evaluation_comparison';
import { ImprovementAction } from '../models/improvement_action';

export type ExportCell =
    | string
    | number
    | boolean
    | null
    | undefined;

export interface ExportTable {
    headers: string[];
    rows: ExportCell[][];
}

@Injectable({
    providedIn: 'root'
})
export class AdvancedExportService {
    private readonly delimiter = ',';

    generateCsv(table: ExportTable): string {
        this.validateTable(table);

        const headers = table.headers.map(header =>
            this.escapeCsvCell(header)
        );

        const rows = table.rows.map(row =>
            row.map(value =>
                this.escapeCsvCell(value)
            ).join(this.delimiter)
        );

        return '\uFEFF' + [
            headers.join(this.delimiter),
            ...rows
        ].join('\r\n');
    }

    generateXlsx(table: ExportTable): ArrayBuffer {
        this.validateTable(table);

        const data: ExportCell[][] = [
            table.headers.map(header => this.sanitizeText(header)),
            ...table.rows.map(row =>
                row.map(value =>
                    typeof value === 'string'
                        ? this.sanitizeText(value)
                        : value ?? null
                )
            )
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(data);

        // Mantener los encabezados y el contenido legibles.
        worksheet['!cols'] = table.headers.map((header, index) => {
            const maxLength = Math.max(
                header.length,
                ...table.rows.map(row =>
                    String(row[index] ?? '').length
                )
            );

            return {
                wch: Math.min(Math.max(maxLength + 2, 12), 50)
            };
        });

        const workbook = XLSX.utils.book_new();

        XLSX.utils.book_append_sheet(
            workbook,
            worksheet,
            'Datos'
        );

        return XLSX.write(workbook, {
            bookType: 'xlsx',
            type: 'array'
        }) as ArrayBuffer;
    }

    private validateTable(table: ExportTable): void {
        if (table.headers.length === 0) {
            throw new Error(
                'La exportación requiere al menos una columna.'
            );
        }

        for (const row of table.rows) {
            if (row.length !== table.headers.length) {
                throw new Error(
                    'La cantidad de valores no coincide con las columnas.'
                );
            }
        }
    }

    private sanitizeText(value: string): string {
        if (/^[\s\u0000-\u001F]*[=+\-@]/.test(value)) {
            return "'" + value;
        }

        return value;
    }

    private escapeCsvCell(value: ExportCell): string {
        if (value === null || value === undefined) {
            return '';
        }

        const text = typeof value === 'string'
            ? this.sanitizeText(value)
            : String(value);

        if (
            text.includes(this.delimiter) ||
            text.includes('"') ||
            text.includes('\r') ||
            text.includes('\n')
        ) {
            return '"' + text.replace(/"/g, '""') + '"';
        }

        return text;
    }


    buildHistoryTable(history: EvaluationHistory): ExportTable {
        const ambits = new Map<number, string>();

        for (const evaluation of history.history) {
            for (const ambit of evaluation.ambits) {
                if (!ambits.has(ambit.ambit_id)) {
                    ambits.set(ambit.ambit_id, ambit.ambit_name);
                }
            }
        }

        const ambitColumns = [...ambits.entries()]
            .sort(([idA], [idB]) => idA - idB);

        const headers = [
            'ID de evaluación',
            'Fecha',
            'Puntuación global',
            ...ambitColumns.map(([, name]) => name)
        ];

        const rows: ExportCell[][] = history.history.map(evaluation => {
            const scores = new Map(
                evaluation.ambits.map(ambit => [
                    ambit.ambit_id,
                    ambit.score
                ] as const)
            );

            return [
                evaluation.evaluation_id,
                evaluation.date,
                evaluation.global_score,
                ...ambitColumns.map(([id]) => scores.get(id) ?? null)
            ];
        });

        return { headers, rows };
    }

    buildComparisonTable(
        comparison: EvaluationComparison
    ): ExportTable {
        const ambits = new Map<number, string>();

        for (const evaluation of comparison.evaluations) {
            for (const ambit of evaluation.ambits) {
                if (!ambits.has(ambit.ambit_id)) {
                    ambits.set(
                        ambit.ambit_id,
                        ambit.ambit_name ?? `Ámbito ${ambit.ambit_id}`
                    );
                }
            }
        }

        const ambitColumns = [...ambits.entries()]
            .sort(([idA], [idB]) => idA - idB);

        const includeDifferences =
            comparison.comparable &&
            comparison.differences !== null;

        const headers = [
            'ID de evaluación',
            'Fecha',
            'ID de metodología',
            'Versión metodológica',
            'Puntuación global',
            ...ambitColumns.map(([, name]) => name),
            'Comparable',
            'Advertencia',
            'Diferencia global',
            ...ambitColumns.map(([, name]) =>
                `Diferencia ${name}`
            )
        ];

        const rows: ExportCell[][] =
            comparison.evaluations.map((evaluation, index) => {
                const scores = new Map(
                    evaluation.ambits.map(ambit => [
                        ambit.ambit_id,
                        ambit.score
                    ] as const)
                );

                const differences = includeDifferences && index === 1
                    ? comparison.differences
                    : null;

                const ambitDifferences = new Map(
                    differences?.ambits.map(ambit => [
                        ambit.ambit_id,
                        ambit.delta
                    ] as const) ?? []
                );

                return [
                    evaluation.evaluation_id,
                    evaluation.date,
                    evaluation.methodology_id,
                    evaluation.methodology_version,
                    evaluation.global_score,
                    ...ambitColumns.map(([id]) =>
                        scores.get(id) ?? null
                    ),
                    comparison.comparable ? 'Sí' : 'No',
                    comparison.warning,
                    differences?.global_score ?? null,
                    ...ambitColumns.map(([id]) =>
                        ambitDifferences.get(id) ?? null
                    )
                ];
            });

        return { headers, rows };
    }

    buildImprovementActionsTable(
        actions: ImprovementAction[]
    ): ExportTable {
        const headers = [
            'ID de acción',
            'ID de evaluación',
            'ID de indicador',
            'Brecha identificada',
            'Descripción de la acción',
            'Prioridad',
            'Responsable',
            'Fecha objetivo',
            'Estado',
            'Fecha de creación',
            'Última actualización'
        ];

        const priorityLabels: Record<ImprovementAction['priority'], string> = {
            LOW: 'Baja',
            MEDIUM: 'Media',
            HIGH: 'Alta'
        };

        const statusLabels: Record<ImprovementAction['status'], string> = {
            PENDING: 'Pendiente',
            IN_PROGRESS: 'En progreso',
            COMPLETED: 'Completada',
            CANCELLED: 'Cancelada'
        };

        const rows: ExportCell[][] = actions.map(action => [
            action.id,
            action.evaluation_id,
            action.indicator_id,
            action.gap_description,
            action.description,
            priorityLabels[action.priority],
            action.responsible,
            action.target_date,
            statusLabels[action.status],
            action.created_at,
            action.updated_at
        ]);

        return { headers, rows };
    }

    downloadTable(
        table: ExportTable,
        format: 'csv' | 'xlsx',
        filename: string
    ): void {
        if (!/^[a-zA-Z0-9_-]+$/.test(filename)) {
            throw new Error('El nombre del archivo no es válido.');
        }

        const content = format === 'csv'
            ? new Blob(
                [this.generateCsv(table)],
                { type: 'text/csv;charset=utf-8;' }
            )
            : new Blob(
                [this.generateXlsx(table)],
                {
                    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                }
            );

        const url = URL.createObjectURL(content);
        const anchor = document.createElement('a');

        try {
            anchor.href = url;
            anchor.download = `${filename}.${format}`;

            document.body.appendChild(anchor);
            anchor.click();
        } finally {
            anchor.remove();
            URL.revokeObjectURL(url);
        }
    }
}
