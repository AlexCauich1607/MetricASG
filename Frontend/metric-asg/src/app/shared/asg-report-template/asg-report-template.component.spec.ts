
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AsgReportTemplateComponent } from './asg-report-template.component';
import { AsgReport } from '../../models/asg_report';
import { User } from '../../models/user';
import { AsgReportPaginatorService } from '../../services/asg-report-paginator.service';
import { EvaluationComparison } from '../../models/evaluation_comparison';

describe('AsgReportTemplateComponent', () => {
    let fixture: ComponentFixture<AsgReportTemplateComponent>;

    const report: AsgReport = {
        company: {
            id: 1,
            company_name: 'Empresa de prueba'
        } as User,

        evaluation: {
            evaluation_id: 20,
            date: '2026-11-04',
            global_score: 75.5,
            global_maturity_level: 'Intermedio',
            ambits: [
                {
                    ambit_id: 1,
                    ambit_name: 'Ambiental',
                    score: 80,
                    letter: 'A',
                    color: '#278452',
                    maturity_level: 'Avanzado',
                    maturity_color: '#278452',
                    feedback: 'Se identificaron oportunidades de mejora.'
                }
            ]
        },

        comparison: null,

        improvement_actions: [
            {
                id: 1,
                evaluation_id: 20,
                indicator_id: null,
                gap_description: 'Falta documentar procesos ambientales.',
                description: 'Documentar los procesos ambientales.',
                priority: 'HIGH',
                responsible: 'Responsable ambiental',
                target_date: '2026-12-15',
                status: 'IN_PROGRESS',
                created_at: '2026-11-04T10:00:00',
                updated_at: '2026-11-04T10:00:00'
            }
        ],

        improvement_progress: {
            evaluation_id: 20,
            total: 1,
            pending: 0,
            in_progress: 1,
            completed: 0,
            cancelled: 0,
            progress_percentage: 0
        }
    };

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [AsgReportTemplateComponent]
        }).compileComponents();

        fixture = TestBed.createComponent(
            AsgReportTemplateComponent
        );

        fixture.componentRef.setInput('report', report);
        fixture.detectChanges();
    });

    afterEach(() => {
        fixture.destroy();
    });

    it('should render all six report sections', () => {
        const element = fixture.nativeElement as HTMLElement;

        const sections = element.querySelectorAll(
            '[data-pdf-section]'
        );

        expect(sections.length).toBe(6);

        expect(
            element.querySelector('[data-pdf-root]')
        ).not.toBeNull();
    });

    it('should render evaluation and improvement data', () => {
        const element = fixture.nativeElement as HTMLElement;
        const text = element.textContent ?? '';

        expect(text).toContain('Empresa de prueba');
        expect(text).toContain('Ambiental');
        expect(text).toContain('75.5');
        expect(text).toContain(
            'Documentar los procesos ambientales.'
        );
        expect(text).toContain('En progreso');
    });

    it('should display a message when no historical comparison exists', () => {
        const text = fixture.nativeElement.textContent as string;

        expect(text).toContain(
            'No existe una evaluación anterior disponible'
        );
    });

    it('should paginate the rendered report without losing sections', () => {
        const paginator = TestBed.inject(AsgReportPaginatorService);

        const host = fixture.nativeElement as HTMLElement;
        const reportElement = host.querySelector<HTMLElement>(
            '[data-pdf-root]'
        );

        expect(reportElement).not.toBeNull();

        if (!reportElement) {
            return;
        }

        // La medición necesita un elemento conectado al documento.
        const attachedHost = host.isConnected
            ? null
            : document.createElement('div');

        if (attachedHost) {
            document.body.appendChild(attachedHost);
            attachedHost.appendChild(host);
        }

        let workspace: HTMLElement | null = null;

        try {
            const result = paginator.paginate(reportElement);
            workspace = result.workspace;

            expect(result.pages.length).toBeGreaterThanOrEqual(6);

            expect(
                result.pages.every(page =>
                    page.hasAttribute('data-pdf-page')
                )
            ).toBeTrue();

            const originalSections = reportElement.querySelectorAll(
                '[data-pdf-section]'
            );

            expect(originalSections.length).toBe(6);

            const exportedText = result.pages
                .map(page => page.textContent ?? '')
                .join(' ');

            expect(exportedText).toContain('Empresa de prueba');
            expect(exportedText).toContain('Ambiental');
            expect(exportedText).toContain(
                'Documentar los procesos ambientales.'
            );

            expect(
                result.pages.every(page =>
                    page.textContent?.trim()
                )
            ).toBeTrue();
            for (const page of result.pages) {
                const pageRect = page.getBoundingClientRect();

                const descendants = Array.from(
                    page.querySelectorAll<HTMLElement>('*')
                );

                for (const element of descendants) {
                    const rect = element.getBoundingClientRect();

                    if (rect.width === 0 && rect.height === 0) {
                        continue;
                    }

                    expect(rect.bottom)
                        .withContext(`Contenido fuera del límite inferior: ${element.tagName}`)
                        .toBeLessThanOrEqual(pageRect.bottom - 56 + 1);
                }
            }
        } finally {
            workspace?.remove();
            attachedHost?.remove();
        }
    });

    it('should display a warning without differences for incompatible evaluations', () => {
        const comparison: EvaluationComparison = {
            comparable: false,
            warning: 'Las evaluaciones utilizan versiones metodológicas diferentes.',
            evaluations: [
                {
                    evaluation_id: 10,
                    date: '2026-05-04',
                    methodology_id: 1,
                    methodology_version: '1.0',
                    global_score: 60,
                    ambits: [
                        {
                            ambit_id: 1,
                            ambit_name: 'Ambiental',
                            score: 65
                        }
                    ]
                },
                {
                    evaluation_id: 20,
                    date: '2026-11-04',
                    methodology_id: 1,
                    methodology_version: '2.0',
                    global_score: 75.5,
                    ambits: [
                        {
                            ambit_id: 1,
                            ambit_name: 'Ambiental',
                            score: 80
                        }
                    ]
                }
            ],
            differences: null
        };

        fixture.componentRef.setInput('report', {
            ...report,
            comparison
        });

        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const sections = element.querySelectorAll<HTMLElement>(
            '[data-pdf-section]'
        );

        const comparisonSection = sections[3];
        const conclusionsSection = sections[5];

        expect(comparisonSection.textContent).toContain(
            'Las evaluaciones utilizan versiones metodológicas diferentes.'
        );

        expect(comparisonSection.textContent).toContain(
            'Las evaluaciones no son comparables.'
        );

        expect(
            comparisonSection.querySelector('.report-difference')
        ).toBeNull();

        expect(
            comparisonSection.querySelector('.report-table')
        ).toBeNull();

        expect(conclusionsSection.textContent).toContain(
            'no permiten calcular diferencias comparables'
        );
    });

    it('should display differences for comparable evaluations', () => {
        const comparison: EvaluationComparison = {
            comparable: true,
            warning: null,
            evaluations: [
                {
                    evaluation_id: 10,
                    date: '2026-05-04',
                    methodology_id: 1,
                    methodology_version: '1.0',
                    global_score: 60,
                    ambits: [
                        {
                            ambit_id: 1,
                            ambit_name: 'Ambiental',
                            score: 65
                        }
                    ]
                },
                {
                    evaluation_id: 20,
                    date: '2026-11-04',
                    methodology_id: 1,
                    methodology_version: '1.0',
                    global_score: 75.5,
                    ambits: [
                        {
                            ambit_id: 1,
                            ambit_name: 'Ambiental',
                            score: 80
                        }
                    ]
                }
            ],
            differences: {
                global_score: 15.5,
                ambits: [
                    {
                        ambit_id: 1,
                        ambit_name: 'Ambiental',
                        delta: 15
                    }
                ]
            }
        };

        fixture.componentRef.setInput('report', {
            ...report,
            comparison
        });

        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;
        const sections = element.querySelectorAll<HTMLElement>(
            '[data-pdf-section]'
        );

        const comparisonSection = sections[3];
        const conclusionsSection = sections[5];

        expect(
            comparisonSection.querySelector('.report-warning')
        ).toBeNull();

        expect(
            comparisonSection.querySelector('.report-difference')
        ).not.toBeNull();

        expect(
            comparisonSection.querySelector('.report-table')
        ).not.toBeNull();

        expect(comparisonSection.textContent).toContain('15.5');
        expect(comparisonSection.textContent).toContain('Ambiental');

        expect(conclusionsSection.textContent).toContain(
            'La diferencia de puntuación global'
        );
    });

    it('should display an empty state when no improvement actions exist', () => {
        fixture.componentRef.setInput('report', {
            ...report,
            improvement_actions: [],
            improvement_progress: {
                evaluation_id: report.evaluation.evaluation_id,
                total: 0,
                pending: 0,
                in_progress: 0,
                completed: 0,
                cancelled: 0,
                progress_percentage: 0
            }
        });

        fixture.detectChanges();

        const element = fixture.nativeElement as HTMLElement;

        const sections = element.querySelectorAll<HTMLElement>(
            '[data-pdf-section]'
        );

        const improvementSection = sections[4];

        expect(improvementSection).toBeDefined();

        expect(improvementSection.textContent).toContain(
            'No hay acciones de mejora registradas para esta evaluación.'
        );

        expect(
            improvementSection.querySelectorAll('.report-action').length
        ).toBe(0);

        const progressItems = improvementSection.querySelectorAll(
            '.report-progress-item strong'
        );

        expect(progressItems.length).toBe(5);

        progressItems.forEach(item => {
            expect(item.textContent?.trim()).toBe('0');
        });

        expect(
            improvementSection.querySelector('.report-progress-heading')
                ?.textContent
        ).toContain('0%');
    });

    it('should render improvement action statuses and progress correctly', () => {
        const baseAction = report.improvement_actions[0];

        const actions = [
            {
                ...baseAction,
                id: 1,
                description: 'Actualizar política ambiental',
                priority: 'HIGH' as const,
                status: 'PENDING' as const
            },
            {
                ...baseAction,
                id: 2,
                description: 'Capacitar al personal',
                priority: 'MEDIUM' as const,
                status: 'IN_PROGRESS' as const
            },
            {
                ...baseAction,
                id: 3,
                description: 'Implementar auditoría interna',
                priority: 'LOW' as const,
                status: 'COMPLETED' as const
            },
            {
                ...baseAction,
                id: 4,
                description: 'Actualizar procedimiento anterior',
                priority: 'LOW' as const,
                status: 'CANCELLED' as const
            }
        ];

        fixture.componentRef.setInput('report', {
            ...report,
            improvement_actions: actions,
            improvement_progress: {
                evaluation_id: report.evaluation.evaluation_id,
                total: 4,
                pending: 1,
                in_progress: 1,
                completed: 1,
                cancelled: 1,
                progress_percentage: 33.33
            }
        });

        fixture.detectChanges();

        const sections = (
            fixture.nativeElement as HTMLElement
        ).querySelectorAll<HTMLElement>('[data-pdf-section]');

        const improvementSection = sections[4];

        const cards = improvementSection.querySelectorAll<HTMLElement>(
            '.report-action'
        );

        expect(cards.length).toBe(4);

        expect(cards[0].textContent).toContain('Alta');
        expect(cards[0].textContent).toContain('Pendiente');

        expect(cards[1].textContent).toContain('Media');
        expect(cards[1].textContent).toContain('En progreso');

        expect(cards[2].textContent).toContain('Baja');
        expect(cards[2].textContent).toContain('Completada');

        expect(cards[3].textContent).toContain('Cancelada');

        const counters = Array.from(
            improvementSection.querySelectorAll(
                '.report-progress-item strong'
            )
        ).map(element => element.textContent?.trim());

        expect(counters).toEqual(['4', '1', '1', '1', '1']);

        expect(
            improvementSection.querySelector('.report-progress-heading')
                ?.textContent
        ).toContain('33.33%');

        const progressBar = improvementSection.querySelector<HTMLElement>(
            '.report-progress-fill'
        );

        expect(progressBar?.style.width).toBe('33.33%');
    });

    it('should preserve scores and observations for each ambit', () => {
        const evaluation = {
            ...report.evaluation,
            global_score: 72.5,
            ambits: [
                {
                    ambit_id: 1,
                    ambit_name: 'Ambiental',
                    score: 80,
                    letter: 'A',
                    color: '#278452',
                    maturity_level: 'Avanzado',
                    maturity_color: '#278452',
                    feedback: 'Fortaleza exclusiva del ámbito ambiental.'
                },
                {
                    ambit_id: 2,
                    ambit_name: 'Social',
                    score: 65,
                    letter: 'S',
                    color: '#C28C20',
                    maturity_level: 'Intermedio',
                    maturity_color: '#C28C20',
                    feedback: 'Oportunidad exclusiva del ámbito social.'
                },
                {
                    ambit_id: 3,
                    ambit_name: 'Gobernanza',
                    score: 72.5,
                    letter: 'G',
                    color: '#3564A0',
                    maturity_level: 'Intermedio',
                    maturity_color: '#3564A0',
                    feedback: 'Observación exclusiva de gobernanza.'
                }
            ]
        };

        fixture.componentRef.setInput('report', {
            ...report,
            evaluation
        });

        fixture.detectChanges();

        const sections = (
            fixture.nativeElement as HTMLElement
        ).querySelectorAll<HTMLElement>('[data-pdf-section]');

        const resultsSection = sections[1];
        const observationsSection = sections[2];

        const resultsText = resultsSection.textContent ?? '';
        const observationsText = observationsSection.textContent ?? '';

        expect(resultsText).toContain('72.5');
        expect(resultsText).toContain('Ambiental');
        expect(resultsText).toContain('Social');
        expect(resultsText).toContain('Gobernanza');

        expect(observationsText).toContain(
            'Fortaleza exclusiva del ámbito ambiental.'
        );

        expect(observationsText).toContain(
            'Oportunidad exclusiva del ámbito social.'
        );

        expect(observationsText).toContain(
            'Observación exclusiva de gobernanza.'
        );

        expect(
            observationsSection.querySelectorAll(
                '.report-observation'
            ).length
        ).toBe(3);
        const observationCards = Array.from(
            observationsSection.querySelectorAll<HTMLElement>(
                '.report-observation'
            )
        );

        const expectedObservations = [
            {
                ambit: 'Ambiental',
                feedback: 'Fortaleza exclusiva del ámbito ambiental.'
            },
            {
                ambit: 'Social',
                feedback: 'Oportunidad exclusiva del ámbito social.'
            },
            {
                ambit: 'Gobernanza',
                feedback: 'Observación exclusiva de gobernanza.'
            }
        ];

        expectedObservations.forEach((expected, index) => {
            const cardText = observationCards[index].textContent ?? '';

            expect(cardText)
                .withContext(`Ámbito ${expected.ambit}`)
                .toContain(expected.ambit);

            expect(cardText)
                .withContext(`Observación de ${expected.ambit}`)
                .toContain(expected.feedback);
        });
    });

    it('should preserve ambit scores and evaluation conclusions', () => {
        const evaluation = {
            ...report.evaluation,
            global_score: 72.5,
            global_maturity_level: 'Intermedio',
            ambits: [
                {
                    ambit_id: 1,
                    ambit_name: 'Ambiental',
                    score: 80,
                    letter: 'A',
                    color: '#278452',
                    maturity_level: 'Avanzado',
                    maturity_color: '#278452',
                    feedback: 'Buen desempeño ambiental.'
                },
                {
                    ambit_id: 2,
                    ambit_name: 'Social',
                    score: 65,
                    letter: 'S',
                    color: '#C28C20',
                    maturity_level: 'Intermedio',
                    maturity_color: '#C28C20',
                    feedback: 'Oportunidades de mejora social.'
                },
                {
                    ambit_id: 3,
                    ambit_name: 'Gobernanza',
                    score: 72.5,
                    letter: 'G',
                    color: '#3564A0',
                    maturity_level: 'Intermedio',
                    maturity_color: '#3564A0',
                    feedback: 'Seguimiento de gobernanza.'
                }
            ]
        };

        fixture.componentRef.setInput('report', {
            ...report,
            evaluation
        });

        fixture.detectChanges();

        const sections = (
            fixture.nativeElement as HTMLElement
        ).querySelectorAll<HTMLElement>('[data-pdf-section]');

        const resultsSection = sections[1];
        const conclusionsSection = sections[5];

        const rows = Array.from(
            resultsSection.querySelectorAll<HTMLTableRowElement>(
                '.report-table tbody tr'
            )
        );

        expect(rows.length).toBe(3);

        const expectedRows = [
            ['Ambiental', '80.0', 'Avanzado'],
            ['Social', '65.0', 'Intermedio'],
            ['Gobernanza', '72.5', 'Intermedio']
        ];

        expectedRows.forEach((expected, index) => {
            const cells = Array.from(rows[index].cells)
                .map(cell => cell.textContent?.trim());

            expect(cells).toEqual(expected);
        });

        const summary = resultsSection.querySelector(
            '.report-summary'
        );

        expect(summary?.textContent).toContain('72.5');
        expect(summary?.textContent).toContain('Intermedio');

        const conclusions = conclusionsSection.querySelectorAll(
            '.report-conclusion'
        );

        expect(conclusions.length).toBe(3);

        const evaluationConclusion = conclusions[0].textContent ?? '';
        const improvementConclusion = conclusions[2].textContent ?? '';

        expect(evaluationConclusion).toContain('Empresa de prueba');
        expect(evaluationConclusion).toContain('72.5');
        expect(evaluationConclusion).toContain('Intermedio');

        expect(improvementConclusion).toContain(
            'El plan de mejora contiene'
        );

        expect(improvementConclusion).toContain(
            'El avance registrado de las acciones activas'
        );
    });

});
