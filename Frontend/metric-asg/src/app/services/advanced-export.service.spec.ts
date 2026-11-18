import * as XLSX from 'xlsx';
import { TestBed } from '@angular/core/testing';

import { AdvancedExportService } from './advanced-export.service';

describe('AdvancedExportService - CSV', () => {
    let service: AdvancedExportService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(AdvancedExportService);
    });

    it('should generate CSV with UTF-8 BOM and CRLF separators', () => {
        const csv = service.generateCsv({
            headers: ['ID', 'Ámbito', 'Puntuación'],
            rows: [
                [1, 'Ambiental', 8.5],
                [2, 'Gobernanza', 9]
            ]
        });

        expect(csv).toBe(
            '\uFEFFID,Ámbito,Puntuación\r\n' +
            '1,Ambiental,8.5\r\n' +
            '2,Gobernanza,9'
        );
    });

    it('should escape commas, quotes and line breaks', () => {
        const csv = service.generateCsv({
            headers: ['Descripción'],
            rows: [
                ['Acción, prioritaria'],
                ['Texto con "comillas"'],
                ['Primera línea\nSegunda línea']
            ]
        });

        expect(csv).toContain('"Acción, prioritaria"');
        expect(csv).toContain('"Texto con ""comillas"""');
        expect(csv).toContain(
            '"Primera línea\nSegunda línea"'
        );
    });

    it('should protect text values against CSV formula injection', () => {
        const csv = service.generateCsv({
            headers: ['Responsable'],
            rows: [
                ['=SUM(1,2)'],
                ['+CMD'],
                ['-10'],
                ['@usuario'],
                ['  =SUM(1,2)']
            ]
        });

        expect(csv).toContain("'=SUM(1,2)");
        expect(csv).toContain("'+CMD");
        expect(csv).toContain("'-10");
        expect(csv).toContain("'@usuario");
        expect(csv).toContain("'  =SUM(1,2)");
    });

    it('should preserve numeric values', () => {
        const csv = service.generateCsv({
            headers: ['Puntuación'],
            rows: [[-2.5], [9.75]]
        });

        expect(csv).toContain('-2.5');
        expect(csv).toContain('9.75');
    });

    it('should reject an empty column definition', () => {
        expect(() =>
            service.generateCsv({
                headers: [],
                rows: []
            })
        ).toThrowError(
            'La exportación requiere al menos una columna.'
        );
    });

    it('should reject rows with an incorrect number of cells', () => {
        expect(() =>
            service.generateCsv({
                headers: ['ID', 'Nombre'],
                rows: [[1]]
            })
        ).toThrowError(
            'La cantidad de valores no coincide con las columnas.'
        );
    });

    it('should preserve Unicode characters and ISO dates in CSV', () => {
        const csv = service.generateCsv({
            headers: ['Descripción', 'Responsable', 'Fecha', 'Actualización'],
            rows: [
                [
                    'Gestión ambiental: áéíóú, ü, ñ, € 🌱',
                    'Muñoz "Dirección"\nEquipo ASG',
                    '2027-01-15',
                    '2026-11-15T14:45:00Z'
                ]
            ]
        });

        expect(csv.startsWith('\uFEFF')).toBeTrue();

        expect(csv).toContain(
            '"Gestión ambiental: áéíóú, ü, ñ, € 🌱"'
        );

        expect(csv).toContain(
            '"Muñoz ""Dirección""\nEquipo ASG"'
        );

        expect(csv).toContain('2027-01-15');
        expect(csv).toContain('2026-11-15T14:45:00Z');
    });

});


describe('AdvancedExportService - XLSX', () => {
    let service: AdvancedExportService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(AdvancedExportService);
    });

    function readWorksheet(buffer: ArrayBuffer): XLSX.WorkSheet {
        const workbook = XLSX.read(buffer, {
            type: 'array'
        });

        expect(workbook.SheetNames).toEqual(['Datos']);

        return workbook.Sheets['Datos'];
    }

    it('should generate a valid XLSX workbook', () => {
        const buffer = service.generateXlsx({
            headers: ['ID', 'Ámbito', 'Puntuación'],
            rows: [
                [1, 'Ambiental', 8.5],
                [2, 'Gobernanza', 9]
            ]
        });

        const worksheet = readWorksheet(buffer);

        const rows = XLSX.utils.sheet_to_json<unknown[]>(
            worksheet,
            { header: 1 }
        );

        expect(rows).toEqual([
            ['ID', 'Ámbito', 'Puntuación'],
            [1, 'Ambiental', 8.5],
            [2, 'Gobernanza', 9]
        ]);
    });

    it('should preserve numeric and boolean cell types', () => {
        const buffer = service.generateXlsx({
            headers: ['Puntuación', 'Activo'],
            rows: [
                [9.75, true],
                [-2.5, false]
            ]
        });

        const worksheet = readWorksheet(buffer);

        expect(worksheet['A2'].t).toBe('n');
        expect(worksheet['A2'].v).toBe(9.75);

        expect(worksheet['B2'].t).toBe('b');
        expect(worksheet['B2'].v).toBe(true);

        expect(worksheet['A3'].t).toBe('n');
        expect(worksheet['B3'].t).toBe('b');
    });

    it('should preserve accented characters', () => {
        const buffer = service.generateXlsx({
            headers: ['Descripción'],
            rows: [
                ['Gestión ambiental'],
                ['Evaluación de gobernanza']
            ]
        });

        const worksheet = readWorksheet(buffer);

        expect(worksheet['A2'].v).toBe('Gestión ambiental');
        expect(worksheet['A3'].v).toBe(
            'Evaluación de gobernanza'
        );
    });

    it('should prevent text values from becoming formulas', () => {
        const buffer = service.generateXlsx({
            headers: ['Responsable'],
            rows: [
                ['=SUM(1,2)'],
                ['+CMD'],
                ['@usuario']
            ]
        });

        const worksheet = readWorksheet(buffer);

        expect(worksheet['A2'].t).toBe('s');
        expect(worksheet['A2'].v).toBe("'=SUM(1,2)");
        expect(worksheet['A2'].f).toBeUndefined();

        expect(worksheet['A3'].v).toBe("'+CMD");
        expect(worksheet['A4'].v).toBe("'@usuario");
    });

    it('should reject rows with mismatched columns', () => {
        expect(() =>
            service.generateXlsx({
                headers: ['ID', 'Nombre'],
                rows: [[1]]
            })
        ).toThrowError(
            'La cantidad de valores no coincide con las columnas.'
        );
    });

    it('should reject empty column definitions', () => {
        expect(() =>
            service.generateXlsx({
                headers: [],
                rows: []
            })
        ).toThrowError(
            'La exportación requiere al menos una columna.'
        );
    });

    it('should preserve empty cells without shifting XLSX columns', () => {
        const buffer = service.generateXlsx({
            headers: [
                'Evaluación',
                'Indicador',
                'Puntuación',
                'Estado'
            ],
            rows: [
                [10, null, 8.5, 'Completada'],
                [11, 25, null, 'Pendiente']
            ]
        });

        const worksheet = readWorksheet(buffer);

        expect(worksheet['A2'].v).toBe(10);
        expect(worksheet['B2']).toBeUndefined();
        expect(worksheet['C2'].v).toBe(8.5);
        expect(worksheet['D2'].v).toBe('Completada');

        expect(worksheet['A3'].v).toBe(11);
        expect(worksheet['B3'].v).toBe(25);
        expect(worksheet['C3']).toBeUndefined();
        expect(worksheet['D3'].v).toBe('Pendiente');

        const rows = XLSX.utils.sheet_to_json<unknown[]>(
            worksheet,
            {
                header: 1,
                defval: null
            }
        );

        expect(rows).toEqual([
            ['Evaluación', 'Indicador', 'Puntuación', 'Estado'],
            [10, null, 8.5, 'Completada'],
            [11, 25, null, 'Pendiente']
        ]);
    });

});

describe('AdvancedExportService - History', () => {
    let service: AdvancedExportService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(AdvancedExportService);
    });

    it('should transform evaluation history into tabular data', () => {
        const table = service.buildHistoryTable({
            history: [
                {
                    evaluation_id: 1,
                    date: '2026-01-15',
                    global_score: 8.5,
                    ambits: [
                        {
                            ambit_id: 1,
                            ambit_name: 'Ambiental',
                            ambit_color: '#008000',
                            score: 8
                        },
                        {
                            ambit_id: 2,
                            ambit_name: 'Social',
                            ambit_color: '#0000FF',
                            score: 9
                        }
                    ]
                },
                {
                    evaluation_id: 2,
                    date: '2026-06-20',
                    global_score: 9,
                    ambits: [
                        {
                            ambit_id: 1,
                            ambit_name: 'Ambiental',
                            ambit_color: '#008000',
                            score: 9.5
                        },
                        {
                            ambit_id: 2,
                            ambit_name: 'Social',
                            ambit_color: '#0000FF',
                            score: 8.5
                        }
                    ]
                }
            ],
            averages: {
                global_score: 8.75,
                ambits: []
            }
        });

        expect(table.headers).toEqual([
            'ID de evaluación',
            'Fecha',
            'Puntuación global',
            'Ambiental',
            'Social'
        ]);

        expect(table.rows).toEqual([
            [1, '2026-01-15', 8.5, 8, 9],
            [2, '2026-06-20', 9, 9.5, 8.5]
        ]);
    });

    it('should sort ambit columns by their identifiers', () => {
        const table = service.buildHistoryTable({
            history: [
                {
                    evaluation_id: 1,
                    date: '2026-01-15',
                    global_score: 8,
                    ambits: [
                        {
                            ambit_id: 3,
                            ambit_name: 'Gobernanza',
                            ambit_color: '#000000',
                            score: 7
                        },
                        {
                            ambit_id: 1,
                            ambit_name: 'Ambiental',
                            ambit_color: '#008000',
                            score: 9
                        }
                    ]
                }
            ],
            averages: {
                global_score: 8,
                ambits: []
            }
        });

        expect(table.headers).toEqual([
            'ID de evaluación',
            'Fecha',
            'Puntuación global',
            'Ambiental',
            'Gobernanza'
        ]);

        expect(table.rows[0]).toEqual([
            1,
            '2026-01-15',
            8,
            9,
            7
        ]);
    });

    it('should preserve missing ambit scores as null', () => {
        const table = service.buildHistoryTable({
            history: [
                {
                    evaluation_id: 1,
                    date: '2026-01-15',
                    global_score: 8,
                    ambits: [
                        {
                            ambit_id: 1,
                            ambit_name: 'Ambiental',
                            ambit_color: '#008000',
                            score: 8
                        }
                    ]
                },
                {
                    evaluation_id: 2,
                    date: '2026-06-20',
                    global_score: 9,
                    ambits: [
                        {
                            ambit_id: 2,
                            ambit_name: 'Social',
                            ambit_color: '#0000FF',
                            score: 9
                        }
                    ]
                }
            ],
            averages: {
                global_score: 8.5,
                ambits: []
            }
        });

        expect(table.rows).toEqual([
            [1, '2026-01-15', 8, 8, null],
            [2, '2026-06-20', 9, null, 9]
        ]);
    });

    it('should generate headers without ambit columns for empty history', () => {
        const table = service.buildHistoryTable({
            history: [],
            averages: {
                global_score: 0,
                ambits: []
            }
        });

        expect(table.headers).toEqual([
            'ID de evaluación',
            'Fecha',
            'Puntuación global'
        ]);

        expect(table.rows).toEqual([]);
    });
});

describe('AdvancedExportService - Comparison', () => {
    let service: AdvancedExportService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(AdvancedExportService);
    });

    it('should export comparable evaluations and their differences', () => {
        const table = service.buildComparisonTable({
            comparable: true,
            warning: null,
            evaluations: [
                {
                    evaluation_id: 10,
                    date: '2026-01-15',
                    methodology_id: 1,
                    methodology_version: '1.0',
                    global_score: 7.5,
                    ambits: [
                        { ambit_id: 1, ambit_name: 'Ambiental', score: 7 },
                        { ambit_id: 2, ambit_name: 'Social', score: 8 }
                    ]
                },
                {
                    evaluation_id: 20,
                    date: '2026-06-15',
                    methodology_id: 1,
                    methodology_version: '1.0',
                    global_score: 8.5,
                    ambits: [
                        { ambit_id: 1, ambit_name: 'Ambiental', score: 9 },
                        { ambit_id: 2, ambit_name: 'Social', score: 8 }
                    ]
                }
            ],
            differences: {
                global_score: 1,
                ambits: [
                    { ambit_id: 1, ambit_name: 'Ambiental', delta: 2 },
                    { ambit_id: 2, ambit_name: 'Social', delta: 0 }
                ]
            }
        });

        expect(table.headers).toEqual([
            'ID de evaluación',
            'Fecha',
            'ID de metodología',
            'Versión metodológica',
            'Puntuación global',
            'Ambiental',
            'Social',
            'Comparable',
            'Advertencia',
            'Diferencia global',
            'Diferencia Ambiental',
            'Diferencia Social'
        ]);

        expect(table.rows).toEqual([
            [10, '2026-01-15', 1, '1.0', 7.5, 7, 8,
                'Sí', null, null, null, null],
            [20, '2026-06-15', 1, '1.0', 8.5, 9, 8,
                'Sí', null, 1, 2, 0]
        ]);
    });

    it('should not export differences for incompatible methodologies', () => {
        const table = service.buildComparisonTable({
            comparable: false,
            warning: 'Las metodologías no son comparables.',
            evaluations: [
                {
                    evaluation_id: 10,
                    date: '2026-01-15',
                    methodology_id: 1,
                    methodology_version: '1.0',
                    global_score: 7.5,
                    ambits: []
                },
                {
                    evaluation_id: 20,
                    date: '2026-06-15',
                    methodology_id: 2,
                    methodology_version: '2.0',
                    global_score: 8.5,
                    ambits: []
                }
            ],
            differences: null
        });

        expect(table.rows.length).toBe(2);
        expect(table.rows[0]).toEqual([
            10, '2026-01-15', 1, '1.0', 7.5,
            'No', 'Las metodologías no son comparables.', null
        ]);
        expect(table.rows[1]).toEqual([
            20, '2026-06-15', 2, '2.0', 8.5,
            'No', 'Las metodologías no son comparables.', null
        ]);
    });

    it('should preserve dynamic ambit columns and missing scores', () => {
        const table = service.buildComparisonTable({
            comparable: true,
            warning: null,
            evaluations: [
                {
                    evaluation_id: 1,
                    date: '2026-01-01',
                    methodology_id: 1,
                    methodology_version: '1.0',
                    global_score: 8,
                    ambits: [
                        { ambit_id: 3, ambit_name: 'Gobernanza', score: 8 }
                    ]
                },
                {
                    evaluation_id: 2,
                    date: '2026-02-01',
                    methodology_id: 1,
                    methodology_version: '1.0',
                    global_score: 9,
                    ambits: [
                        { ambit_id: 1, ambit_name: 'Ambiental', score: 9 }
                    ]
                }
            ],
            differences: {
                global_score: 1,
                ambits: []
            }
        });

        expect(table.headers).toContain('Ambiental');
        expect(table.headers).toContain('Gobernanza');
        expect(table.headers).toContain('Diferencia Ambiental');
        expect(table.headers).toContain('Diferencia Gobernanza');

        expect(table.rows[0][5]).toBeNull();
        expect(table.rows[0][6]).toBe(8);
        expect(table.rows[1][5]).toBe(9);
        expect(table.rows[1][6]).toBeNull();
    });

    it('should leave differences empty when they are unavailable', () => {
        const table = service.buildComparisonTable({
            comparable: true,
            warning: null,
            evaluations: [
                {
                    evaluation_id: 1,
                    date: '2026-01-01',
                    methodology_id: 1,
                    methodology_version: '1.0',
                    global_score: 8,
                    ambits: []
                }
            ],
            differences: null
        });

        expect(table.rows).toEqual([
            [1, '2026-01-01', 1, '1.0', 8, 'Sí', null, null]
        ]);
    });

    it('should preserve Unicode text and ISO dates as strings in XLSX', () => {
        const buffer = service.generateXlsx({
            headers: ['Descripción', 'Fecha objetivo', 'Actualización'],
            rows: [
                [
                    'Gestión ASG: áéíóú, ü, ñ, € 🌱',
                    '2027-01-15',
                    '2026-11-15T14:45:00Z'
                ]
            ]
        });

        const workbook = XLSX.read(buffer, {
            type: 'array'
        });

        expect(workbook.SheetNames).toEqual(['Datos']);

        const worksheet = workbook.Sheets['Datos'];

        expect(worksheet['A2'].t).toBe('s');
        expect(worksheet['A2'].v).toBe(
            'Gestión ASG: áéíóú, ü, ñ, € 🌱'
        );

        expect(worksheet['B2'].t).toBe('s');
        expect(worksheet['B2'].v).toBe('2027-01-15');

        expect(worksheet['C2'].t).toBe('s');
        expect(worksheet['C2'].v).toBe(
            '2026-11-15T14:45:00Z'
        );
    });

});


describe('AdvancedExportService - Improvement Actions', () => {
    let service: AdvancedExportService;

    beforeEach(() => {
        TestBed.configureTestingModule({});
        service = TestBed.inject(AdvancedExportService);
    });

    it('should transform improvement actions into tabular data', () => {
        const table = service.buildImprovementActionsTable([
            {
                id: 1,
                evaluation_id: 10,
                indicator_id: 5,
                gap_description: 'Falta de políticas ambientales',
                description: 'Implementar una política ambiental',
                priority: 'HIGH',
                responsible: 'Coordinación ASG',
                target_date: '2026-12-15',
                status: 'IN_PROGRESS',
                created_at: '2026-11-01T10:00:00Z',
                updated_at: '2026-11-10T12:00:00Z'
            }
        ]);

        expect(table.headers).toEqual([
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
        ]);

        expect(table.rows).toEqual([
            [
                1,
                10,
                5,
                'Falta de políticas ambientales',
                'Implementar una política ambiental',
                'Alta',
                'Coordinación ASG',
                '2026-12-15',
                'En progreso',
                '2026-11-01T10:00:00Z',
                '2026-11-10T12:00:00Z'
            ]
        ]);
    });

    it('should translate all priorities and statuses', () => {
        const priorities = ['LOW', 'MEDIUM', 'HIGH'] as const;
        const statuses = [
            'PENDING',
            'IN_PROGRESS',
            'COMPLETED',
            'CANCELLED'
        ] as const;

        const actions = statuses.map((status, index) => ({
            id: index + 1,
            evaluation_id: 10,
            indicator_id: null,
            gap_description: 'Brecha',
            description: 'Acción',
            priority: priorities[index % priorities.length],
            responsible: 'Responsable',
            target_date: '2026-12-01',
            status,
            created_at: '2026-11-01T10:00:00Z',
            updated_at: '2026-11-01T10:00:00Z'
        }));

        const table = service.buildImprovementActionsTable(actions);

        expect(table.rows.map(row => row[5])).toEqual([
            'Baja',
            'Media',
            'Alta',
            'Baja'
        ]);

        expect(table.rows.map(row => row[8])).toEqual([
            'Pendiente',
            'En progreso',
            'Completada',
            'Cancelada'
        ]);
    });

    it('should preserve null indicator identifiers', () => {
        const table = service.buildImprovementActionsTable([
            {
                id: 2,
                evaluation_id: 10,
                indicator_id: null,
                gap_description: 'Brecha general',
                description: 'Realizar capacitación',
                priority: 'MEDIUM',
                responsible: 'Recursos Humanos',
                target_date: '2026-12-20',
                status: 'PENDING',
                created_at: '2026-11-01T10:00:00Z',
                updated_at: '2026-11-01T10:00:00Z'
            }
        ]);

        expect(table.rows[0][2]).toBeNull();
    });

    it('should return headers and no rows for an empty action list', () => {
        const table = service.buildImprovementActionsTable([]);

        expect(table.headers.length).toBe(11);
        expect(table.rows).toEqual([]);
    });

    it('should preserve original dates and descriptive text', () => {
        const table = service.buildImprovementActionsTable([
            {
                id: 3,
                evaluation_id: 20,
                indicator_id: 8,
                gap_description: 'Gestión de residuos, agua y energía',
                description: 'Evaluar "indicadores" y diseñar mejoras',
                priority: 'HIGH',
                responsible: 'Dirección Ambiental',
                target_date: '2027-01-15',
                status: 'COMPLETED',
                created_at: '2026-11-01T08:30:00Z',
                updated_at: '2026-11-15T14:45:00Z'
            }
        ]);

        expect(table.rows[0][3]).toBe(
            'Gestión de residuos, agua y energía'
        );

        expect(table.rows[0][4]).toBe(
            'Evaluar "indicadores" y diseñar mejoras'
        );

        expect(table.rows[0][7]).toBe('2027-01-15');
        expect(table.rows[0][9]).toBe('2026-11-01T08:30:00Z');
        expect(table.rows[0][10]).toBe('2026-11-15T14:45:00Z');
    });
});


describe('AdvancedExportService - Formula Safety', () => {
  let service: AdvancedExportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AdvancedExportService);
  });

  it('should neutralize potentially dangerous text in CSV and XLSX', () => {
    const dangerousValues = [
      '=SUM(1,2)',
      '+CMD',
      '-10',
      '@usuario',
      '  =SUM(1,2)',
      '\t=SUM(1,2)',
      '\n+CMD',
      '\r@usuario'
    ];

    const table = {
      headers: ['Contenido'],
      rows: dangerousValues.map(value => [value])
    };

    const csv = service.generateCsv(table);

    for (const value of dangerousValues) {
      expect(csv).toContain("'" + value);
    }

    const buffer = service.generateXlsx(table);
    const workbook = XLSX.read(buffer, { type: 'array' });
    const worksheet = workbook.Sheets['Datos'];

    dangerousValues.forEach((value, index) => {
      const address = `A${index + 2}`;
      const cell = worksheet[address];

      expect(cell).toBeDefined();
      expect(cell.t).toBe('s');
      expect(cell.v).toBe("'" + value);
      expect(cell.f).toBeUndefined();
    });
  });
});
