import { signal } from '@angular/core';

import { CompanyContextService } from
  '../../../services/company-context.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  convertToParamMap,
  Router
} from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ImprovementPlanComponent } from './improvement-plan.component';
import { ImprovementActionService } from '../../../services/improvement-action.service';
import { ImprovementAction } from '../../../models/improvement_action';

import {
  AdvancedExportService,
  ExportTable
} from '../../../services/advanced-export.service';

import { EvaluationService } from
  '../../../services/evaluation.service';

import {
  EvaluationHistory,
  History
} from '../../../models/history_evaluations';

describe('ImprovementPlanComponent', () => {
  let component: ImprovementPlanComponent;
  let fixture: ComponentFixture<ImprovementPlanComponent>;
  let improvementActionService: jasmine.SpyObj<ImprovementActionService>;
  let routeParams: Subject<ReturnType<typeof convertToParamMap>>;
  let selectedCompanyId: ReturnType<typeof signal<number | null>>;
  let evaluationService:
    jasmine.SpyObj<EvaluationService>;

  let router: jasmine.SpyObj<Router>;

  const action: ImprovementAction = {
    id: 5,
    evaluation_id: 10,
    indicator_id: null,
    gap_description: 'Consumo energético elevado',
    description: 'Implementar iluminación LED',
    priority: 'HIGH',
    responsible: 'Operaciones',
    target_date: '2026-12-15',
    status: 'PENDING',
    created_at: '2026-11-03T12:00:00Z',
    updated_at: '2026-11-03T12:00:00Z'
  };


  function buildHistory(
    evaluationIds: number[]
  ): EvaluationHistory {

    const history: History[] =
      evaluationIds.map(evaluationId => ({

        evaluation_id: evaluationId,

        date: '2026-11-20',

        global_score: 7.5,

        ambits: []

      }));

    return {

      history,

      averages: {

        global_score: 7.5,

        ambits: []

      }

    };

  }


  beforeEach(async () => {
    routeParams = new Subject();

    improvementActionService = jasmine.createSpyObj(
      'ImprovementActionService',
      ['getActions', 'getProgressMetrics', 'createAction', 'updateAction', 'deleteAction']
    );

    improvementActionService.getActions.and.returnValue(of([]));

    improvementActionService.getProgressMetrics.and.returnValue(
      of({
        evaluation_id: 10,
        total: 0,
        pending: 0,
        in_progress: 0,
        completed: 0,
        cancelled: 0,
        progress_percentage: 0
      })
    );

    selectedCompanyId = signal<number | null>(1);

    router = jasmine.createSpyObj(
      'Router',
      ['navigate']
    );

    router.navigate.and.returnValue(
      Promise.resolve(true)
    );

    evaluationService =
      jasmine.createSpyObj<EvaluationService>(
        'EvaluationService',
        ['getEvaluationHistory']
      );

    evaluationService.getEvaluationHistory.and.returnValue(
      of(buildHistory([10, 11, 20]))
    );

    await TestBed.configureTestingModule({
      imports: [ImprovementPlanComponent],
      providers: [
        {
          provide: ImprovementActionService,
          useValue: improvementActionService
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: routeParams.asObservable()
          }
        },
        {
          provide: CompanyContextService,
          useValue: {
            selectedCompanyId
          }
        },
        {
          provide: Router,
          useValue: router
        },
        {
          provide: EvaluationService,
          useValue: evaluationService
        },
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ImprovementPlanComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should load actions for a valid evaluation ID', () => {
    improvementActionService.getActions.and.returnValue(of([action]));

    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    expect(component.evaluationId).toBe(10);
    expect(improvementActionService.getActions).toHaveBeenCalledWith(10);
    expect(component.actions).toEqual([action]);
    expect(component.loading).toBeFalse();
  });

  it('should reject an invalid evaluation ID', () => {
    routeParams.next(convertToParamMap({ evaluationId: 'invalid' }));
    fixture.detectChanges();

    expect(component.evaluationId).toBeNull();
    expect(component.errorMessage).toBe(
      'El identificador de la evaluación no es válido.'
    );
    expect(improvementActionService.getActions).not.toHaveBeenCalled();
  });

  it('should show an empty state when there are no actions', () => {
    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    expect(component.actions).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain(
      'No hay acciones de mejora registradas.'
    );
  });

  it('should handle a service error', () => {
    improvementActionService.getActions.and.returnValue(
      throwError(() => new Error('Request failed'))
    );

    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    expect(component.loading).toBeFalse();
    expect(component.actions).toEqual([]);
    expect(component.errorMessage).toBe(
      'No se pudieron cargar las acciones de mejora.'
    );
  });


  it('should create an improvement action and reload the list', () => {
    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    improvementActionService.createAction.and.returnValue(of(action));
    improvementActionService.getActions.and.returnValue(of([action]));

    component.showCreateForm = true;

    component.newAction = {
      indicator_id: null,
      gap_description: ' Consumo energético elevado ',
      description: ' Implementar iluminación LED ',
      priority: 'HIGH',
      responsible: ' Operaciones ',
      target_date: '2026-12-15'
    };

    component.createAction();
    fixture.detectChanges();

    expect(improvementActionService.createAction).toHaveBeenCalledWith(
      10,
      {
        indicator_id: null,
        gap_description: 'Consumo energético elevado',
        description: 'Implementar iluminación LED',
        priority: 'HIGH',
        responsible: 'Operaciones',
        target_date: '2026-12-15'
      }
    );

    expect(improvementActionService.getActions).toHaveBeenCalledTimes(2);
    expect(component.actions).toEqual([action]);
    expect(component.saving).toBeFalse();
    expect(component.showCreateForm).toBeFalse();
    expect(component.formError).toBeNull();
    expect(component.newAction.description).toBe('');
    expect(
      improvementActionService.getProgressMetrics
    ).toHaveBeenCalledTimes(2);
  });

  [
    'gap_description',
    'description',
    'responsible',
    'target_date'
  ].forEach(field => {
    it(`should reject an empty ${field} when creating an action`, () => {
      routeParams.next(convertToParamMap({ evaluationId: '10' }));
      fixture.detectChanges();

      component.newAction = {
        indicator_id: null,
        gap_description: 'Consumo energético elevado',
        description: 'Implementar iluminación LED',
        priority: 'MEDIUM',
        responsible: 'Operaciones',
        target_date: '2026-12-15'
      };

      component.newAction = {
        ...component.newAction,
        [field]: '   '
      };

      component.createAction();

      expect(improvementActionService.createAction)
        .not.toHaveBeenCalled();

      expect(component.formError).toBe(
        'Completa todos los campos obligatorios.'
      );

      expect(component.saving).toBeFalse();
    });
  });

  it('should preserve the form when action creation fails', () => {
    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    const payload = {
      indicator_id: null,
      gap_description: 'Consumo energético elevado',
      description: 'Implementar iluminación LED',
      priority: 'HIGH' as const,
      responsible: 'Operaciones',
      target_date: '2026-12-15'
    };

    improvementActionService.createAction.and.returnValue(
      throwError(() => new Error('Request failed'))
    );

    component.toggleCreateForm();
    component.newAction = { ...payload };

    component.createAction();
    fixture.detectChanges();

    expect(improvementActionService.createAction).toHaveBeenCalledWith(
      10,
      payload
    );

    expect(component.saving).toBeFalse();
    expect(component.showCreateForm).toBeTrue();
    expect(component.activeModal).toBe('create');
    expect(component.newAction).toEqual(payload);

    expect(component.formError).toBe(
      'No se pudo registrar la acción de mejora. Verifica los datos e inténtalo nuevamente.'
    );

    expect(fixture.nativeElement.textContent).toContain(
      'No se pudo registrar la acción de mejora.'
    );
  });


  it('should update an improvement action and reload the list', () => {
    const updatedAction: ImprovementAction = {
      ...action,
      description: 'Reducir el consumo energético',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS'
    };

    improvementActionService.getActions.and.returnValues(
      of([action]),
      of([updatedAction])
    );

    improvementActionService.updateAction.and.returnValue(
      of(updatedAction)
    );

    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    component.startEditing(action);

    expect(component.editingActionId).toBe(5);
    expect(component.editAction.description).toBe(
      'Implementar iluminación LED'
    );

    component.editAction.description = ' Reducir el consumo energético ';
    component.editAction.priority = 'MEDIUM';
    component.editAction.status = 'IN_PROGRESS';

    component.updateAction();
    fixture.detectChanges();

    expect(improvementActionService.updateAction).toHaveBeenCalledWith(
      10,
      5,
      {
        indicator_id: null,
        gap_description: 'Consumo energético elevado',
        description: 'Reducir el consumo energético',
        priority: 'MEDIUM',
        responsible: 'Operaciones',
        target_date: '2026-12-15',
        status: 'IN_PROGRESS'
      }
    );

    expect(improvementActionService.getActions).toHaveBeenCalledTimes(2);
    expect(component.actions).toEqual([updatedAction]);
    expect(component.editingActionId).toBeNull();
    expect(component.editAction).toEqual({});
    expect(component.updating).toBeFalse();
    expect(component.editError).toBeNull();
    expect(
      improvementActionService.getProgressMetrics
    ).toHaveBeenCalledTimes(2);
  });

  it('should preserve the edit form when updating an action fails', () => {
    improvementActionService.getActions.and.returnValue(of([action]));

    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    improvementActionService.updateAction.and.returnValue(
      throwError(() => new Error('Request failed'))
    );

    component.startEditing(action);
    component.editAction.description = ' Reducir consumo energético ';

    component.updateAction();
    fixture.detectChanges();

    expect(improvementActionService.updateAction).toHaveBeenCalledWith(
      10,
      5,
      jasmine.objectContaining({
        description: 'Reducir consumo energético'
      })
    );

    expect(component.updating).toBeFalse();
    expect(component.editingActionId).toBe(5);
    expect(component.editAction.description).toBe(
      ' Reducir consumo energético '
    );

    expect(component.editError).toBe(
      'No se pudo actualizar la acción de mejora. Verifica los datos e inténtalo nuevamente.'
    );

    expect(fixture.nativeElement.textContent).toContain(
      'No se pudo actualizar la acción de mejora.'
    );

    expect(improvementActionService.getActions).toHaveBeenCalledTimes(1);
  });

  it('should delete an action after confirmation and reload the list', () => {
    improvementActionService.getActions.and.returnValues(
      of([action]),
      of([])
    );

    improvementActionService.deleteAction.and.returnValue(
      of(undefined)
    );

    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    expect(component.actions).toEqual([action]);

    // Solicitar la eliminación todavía no debe llamar al servicio.
    component.requestDelete(action.id);
    fixture.detectChanges();

    expect(component.confirmDeleteActionId).toBe(action.id);
    expect(improvementActionService.deleteAction)
      .not.toHaveBeenCalled();

    expect(fixture.nativeElement.textContent).toContain(
      '¿Estás seguro de que deseas eliminar esta acción de mejora?'
    );

    // Confirmar la eliminación.
    component.deleteAction();
    fixture.detectChanges();

    expect(improvementActionService.deleteAction)
      .toHaveBeenCalledOnceWith(10, 5);

    expect(improvementActionService.getActions)
      .toHaveBeenCalledTimes(2);

    expect(component.actions).toEqual([]);
    expect(component.deletingActionId).toBeNull();
    expect(component.confirmDeleteActionId).toBeNull();
    expect(component.deleteError).toBeNull();

    expect(fixture.nativeElement.textContent).toContain(
      'No hay acciones de mejora registradas.'
    );
    expect(
      improvementActionService.getProgressMetrics
    ).toHaveBeenCalledTimes(2);
  });


  it('should cancel deletion without calling the service', () => {
    improvementActionService.getActions.and.returnValue(
      of([action])
    );

    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    component.requestDelete(action.id);

    expect(component.confirmDeleteActionId).toBe(5);

    component.cancelDelete();
    fixture.detectChanges();

    expect(component.confirmDeleteActionId).toBeNull();
    expect(component.deleteError).toBeNull();
    expect(component.actions).toEqual([action]);

    expect(improvementActionService.deleteAction)
      .not.toHaveBeenCalled();
  });

  it('should preserve confirmation when deleting an action fails', () => {
    improvementActionService.getActions.and.returnValue(
      of([action])
    );

    improvementActionService.deleteAction.and.returnValue(
      throwError(() => new Error('Request failed'))
    );

    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    component.requestDelete(action.id);
    component.deleteAction();
    fixture.detectChanges();

    expect(improvementActionService.deleteAction)
      .toHaveBeenCalledOnceWith(10, 5);

    expect(component.deletingActionId).toBeNull();
    expect(component.confirmDeleteActionId).toBe(5);
    expect(component.actions).toEqual([action]);

    expect(component.deleteError).toBe(
      'No se pudo eliminar la acción de mejora. Inténtalo nuevamente.'
    );

    expect(fixture.nativeElement.textContent).toContain(
      'No se pudo eliminar la acción de mejora.'
    );

    expect(improvementActionService.getActions)
      .toHaveBeenCalledTimes(1);
  });

  it('should close the create modal when Escape is pressed', () => {
    component.toggleCreateForm();

    expect(component.activeModal).toBe('create');

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      })
    );

    expect(component.activeModal).toBeNull();
    expect(component.showCreateForm).toBeFalse();
  });

  it('should close the edit modal when Escape is pressed', () => {
    component.startEditing(action);

    expect(component.activeModal).toBe('edit');
    expect(component.editingActionId).toBe(action.id);

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      })
    );

    expect(component.activeModal).toBeNull();
    expect(component.editingActionId).toBeNull();
  });

  it('should not close modals with Escape while saving or updating', () => {
    component.toggleCreateForm();
    component.saving = true;

    component.onEscapeKey();

    expect(component.activeModal).toBe('create');

    component.saving = false;
    component.toggleCreateForm();

    component.startEditing(action);
    component.updating = true;

    component.onEscapeKey();

    expect(component.activeModal).toBe('edit');
    expect(component.editingActionId).toBe(action.id);
  });

  it('should lock and restore body scroll for the create modal', () => {
    const originalOverflow = document.body.style.overflow;

    try {
      document.body.style.overflow = 'auto';

      component.toggleCreateForm();

      expect(component.activeModal).toBe('create');
      expect(document.body.style.overflow).toBe('hidden');

      component.toggleCreateForm();

      expect(component.activeModal).toBeNull();
      expect(document.body.style.overflow).toBe('auto');
    } finally {
      fixture.destroy();
      document.body.style.overflow = originalOverflow;
    }
  });

  it('should lock and restore body scroll for the edit modal', () => {
    const originalOverflow = document.body.style.overflow;

    try {
      document.body.style.overflow = 'auto';

      component.startEditing(action);

      expect(component.activeModal).toBe('edit');
      expect(document.body.style.overflow).toBe('hidden');

      component.cancelEditing();

      expect(component.activeModal).toBeNull();
      expect(document.body.style.overflow).toBe('auto');
    } finally {
      fixture.destroy();
      document.body.style.overflow = originalOverflow;
    }
  });

  it('should load progress metrics for the selected evaluation', () => {
    const expectedProgress = {
      evaluation_id: 10,
      total: 5,
      pending: 1,
      in_progress: 1,
      completed: 2,
      cancelled: 1,
      progress_percentage: 50
    };

    improvementActionService.getProgressMetrics.and.returnValue(
      of(expectedProgress)
    );

    routeParams.next(
      convertToParamMap({ evaluationId: '10' })
    );

    fixture.detectChanges();

    expect(
      improvementActionService.getProgressMetrics
    ).toHaveBeenCalledWith(10);

    expect(component.progress).toEqual(expectedProgress);
    expect(component.loadingProgress).toBeFalse();
    expect(component.progressError).toBeNull();
  });

  it('should handle an error when loading progress metrics', () => {
    improvementActionService.getProgressMetrics.and.returnValue(
      throwError(() => new Error('Request failed'))
    );

    routeParams.next(
      convertToParamMap({ evaluationId: '10' })
    );

    fixture.detectChanges();

    expect(
      improvementActionService.getProgressMetrics
    ).toHaveBeenCalledWith(10);

    expect(component.progress).toBeNull();
    expect(component.loadingProgress).toBeFalse();

    expect(component.progressError).toBe(
      'No se pudieron cargar las métricas de progreso.'
    );

    expect(component.errorMessage).toBeNull();
  });

  it('should disable export buttons when there are no actions', () => {
    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    expect(component.canExportActions).toBeFalse();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];

    const exportButtons = buttons.filter(button =>
      button.textContent?.includes('Exportar')
    );

    expect(exportButtons.length).toBe(2);
    expect(exportButtons.every(button => button.disabled)).toBeTrue();
  });

  it('should export the loaded improvement actions as CSV', () => {
    improvementActionService.getActions.and.returnValue(of([action]));

    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    const exportService = TestBed.inject(AdvancedExportService);

    const table: ExportTable = {
      headers: ['ID', 'Descripción'],
      rows: [[5, action.description]]
    };

    const buildSpy = spyOn(
      exportService,
      'buildImprovementActionsTable'
    ).and.returnValue(table);

    const downloadSpy = spyOn(
      exportService,
      'downloadTable'
    );

    const initialRequests =
      improvementActionService.getActions.calls.count();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];

    const csvButton = buttons.find(button =>
      button.textContent?.includes('Exportar CSV')
    );

    expect(csvButton).toBeDefined();
    expect(csvButton?.disabled).toBeFalse();

    csvButton?.click();

    expect(buildSpy).toHaveBeenCalledOnceWith([action]);

    expect(downloadSpy).toHaveBeenCalledOnceWith(
      table,
      'csv',
      'plan-mejora-evaluacion-10'
    );

    expect(
      improvementActionService.getActions
    ).toHaveBeenCalledTimes(initialRequests);
  });

  it('should export the loaded improvement actions as XLSX', () => {
    improvementActionService.getActions.and.returnValue(of([action]));

    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    const exportService = TestBed.inject(AdvancedExportService);

    const table: ExportTable = {
      headers: ['ID'],
      rows: [[5]]
    };

    const buildSpy = spyOn(
      exportService,
      'buildImprovementActionsTable'
    ).and.returnValue(table);

    const downloadSpy = spyOn(
      exportService,
      'downloadTable'
    );

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];

    const excelButton = buttons.find(button =>
      button.textContent?.includes('Exportar Excel')
    );

    expect(excelButton).toBeDefined();
    expect(excelButton?.disabled).toBeFalse();

    excelButton?.click();

    expect(buildSpy).toHaveBeenCalledOnceWith([action]);

    expect(downloadSpy).toHaveBeenCalledOnceWith(
      table,
      'xlsx',
      'plan-mejora-evaluacion-10'
    );
  });

  it('should block exports while loading or modifying actions', () => {
    improvementActionService.getActions.and.returnValue(of([action]));

    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    const exportService = TestBed.inject(AdvancedExportService);
    const downloadSpy = spyOn(exportService, 'downloadTable');

    expect(component.canExportActions).toBeTrue();

    component.loading = true;
    expect(component.canExportActions).toBeFalse();
    component.exportActions('csv');

    component.loading = false;
    component.saving = true;
    expect(component.canExportActions).toBeFalse();
    component.exportActions('xlsx');

    component.saving = false;
    component.updating = true;
    expect(component.canExportActions).toBeFalse();
    component.exportActions('csv');

    component.updating = false;
    component.deletingActionId = 5;
    expect(component.canExportActions).toBeFalse();
    component.exportActions('xlsx');

    component.deletingActionId = null;
    component.toggleCreateForm();

    expect(component.canExportActions).toBeFalse();
    component.exportActions('csv');

    component.toggleCreateForm();

    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('should export updated actions after reloading the list', () => {
    const updatedAction: ImprovementAction = {
      ...action,
      description: 'Instalar luminarias LED eficientes',
      status: 'IN_PROGRESS'
    };

    improvementActionService.getActions.and.returnValues(
      of([action]),
      of([updatedAction])
    );

    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    const exportService = TestBed.inject(AdvancedExportService);

    const buildSpy = spyOn(
      exportService,
      'buildImprovementActionsTable'
    ).and.callThrough();

    spyOn(exportService, 'downloadTable');

    component.loadActions();
    component.exportActions('csv');

    expect(component.actions).toEqual([updatedAction]);

    expect(buildSpy).toHaveBeenCalledOnceWith([updatedAction]);

    expect(
      improvementActionService.getActions
    ).toHaveBeenCalledTimes(2);
  });

  it('should block export when a different evaluation is loading', () => {
    improvementActionService.getActions.and.returnValue(of([action]));

    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    const exportService = TestBed.inject(AdvancedExportService);
    const downloadSpy = spyOn(exportService, 'downloadTable');

    const pendingActions = new Subject<ImprovementAction[]>();

    improvementActionService.getActions.and.returnValue(
      pendingActions.asObservable()
    );

    routeParams.next(convertToParamMap({ evaluationId: '11' }));
    fixture.detectChanges();

    expect(component.evaluationId).toBe(11);
    expect(component.loading).toBeTrue();
    expect(component.canExportActions).toBeFalse();

    component.exportActions('csv');

    expect(downloadSpy).not.toHaveBeenCalled();
  });

  it('should display an error when improvement export fails', () => {
    improvementActionService.getActions.and.returnValue(of([action]));

    routeParams.next(convertToParamMap({ evaluationId: '10' }));
    fixture.detectChanges();

    const exportService = TestBed.inject(AdvancedExportService);

    spyOn(
      exportService,
      'buildImprovementActionsTable'
    ).and.throwError('Error de exportación');

    spyOn(console, 'error');

    component.exportActions('csv');
    fixture.detectChanges();

    expect(component.exportError).toBe(
      'No fue posible exportar el plan de mejora. Inténtalo nuevamente.'
    );

    const alert = fixture.nativeElement.querySelector(
      '[data-testid="improvement-export-error"]'
    ) as HTMLElement | null;

    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain(
      'No fue posible exportar el plan de mejora.'
    );
  });

  it('should invalidate the plan when the selected company changes', () => {

    improvementActionService.getActions.and.returnValue(
      of([action])
    );

    routeParams.next(
      convertToParamMap({
        evaluationId: '10'
      })
    );

    fixture.detectChanges();

    expect(component.actions).toEqual([action]);

    selectedCompanyId.set(2);

    TestBed.tick();
    fixture.detectChanges();

    expect(component.evaluationId).toBeNull();

    expect(component.actions).toEqual([]);

    expect(component.progress).toBeNull();

    expect(component.canExportActions).toBeFalse();

    expect(router.navigate).toHaveBeenCalledWith([
      '/user/improvement/plan'
    ]);

  });

  it('should ignore pending actions after a company change', () => {

    const pendingActions$ =
      new Subject<ImprovementAction[]>();

    improvementActionService.getActions.and.returnValue(
      pendingActions$.asObservable()
    );

    routeParams.next(
      convertToParamMap({
        evaluationId: '10'
      })
    );

    fixture.detectChanges();

    selectedCompanyId.set(2);

    TestBed.tick();

    pendingActions$.next([action]);

    fixture.detectChanges();

    expect(component.actions).toEqual([]);

    expect(component.evaluationId).toBeNull();

    expect(component.loading).toBeFalse();

  });

  it('should ignore pending actions after an evaluation change', () => {

    const previousActions$ =
      new Subject<ImprovementAction[]>();

    const currentAction: ImprovementAction = {
      ...action,
      id: 6,
      evaluation_id: 20
    };

    improvementActionService.getActions.and.callFake(
      evaluationId =>
        evaluationId === 10
          ? previousActions$.asObservable()
          : of([currentAction])
    );

    routeParams.next(
      convertToParamMap({
        evaluationId: '10'
      })
    );

    routeParams.next(
      convertToParamMap({
        evaluationId: '20'
      })
    );

    previousActions$.next([action]);

    fixture.detectChanges();

    expect(component.evaluationId).toBe(20);

    expect(component.actions).toEqual([
      currentAction
    ]);

  });

  it('should close the create form after a company change', () => {

    routeParams.next(
      convertToParamMap({
        evaluationId: '10'
      })
    );

    fixture.detectChanges();

    component.toggleCreateForm();

    expect(component.activeModal).toBe('create');

    selectedCompanyId.set(2);

    TestBed.tick();
    fixture.detectChanges();

    expect(component.activeModal).toBeNull();

    expect(component.showCreateForm).toBeFalse();

    expect(component.saving).toBeFalse();

    expect(component.newAction.description).toBe('');

  });


  it('should prevent mutations when the company context changes', () => {

    routeParams.next(
      convertToParamMap({
        evaluationId: '10'
      })
    );

    fixture.detectChanges();

    selectedCompanyId.set(2);

    component.createAction();
    component.updateAction();
    component.deleteAction();

    expect(
      improvementActionService.createAction
    ).not.toHaveBeenCalled();

    expect(
      improvementActionService.updateAction
    ).not.toHaveBeenCalled();

    expect(
      improvementActionService.deleteAction
    ).not.toHaveBeenCalled();

  });

  it('should validate evaluation ownership before loading the plan', () => {

    const pendingHistory =
      new Subject<EvaluationHistory>();

    evaluationService.getEvaluationHistory.and.returnValue(
      pendingHistory.asObservable()
    );

    routeParams.next(
      convertToParamMap({ evaluationId: '10' })
    );

    fixture.detectChanges();

    expect(component.validatingEvaluation)
      .toBeTrue();

    expect(component.evaluationId)
      .toBeNull();

    expect(improvementActionService.getActions)
      .not.toHaveBeenCalled();

    expect(improvementActionService.getProgressMetrics)
      .not.toHaveBeenCalled();

    pendingHistory.next(buildHistory([10]));

    fixture.detectChanges();

    expect(component.validatingEvaluation)
      .toBeFalse();

    expect(component.evaluationId)
      .toBe(10);

    expect(improvementActionService.getActions)
      .toHaveBeenCalledOnceWith(10);

    expect(improvementActionService.getProgressMetrics)
      .toHaveBeenCalledOnceWith(10);

  });


  it('should reject an evaluation outside the selected company', () => {

    evaluationService.getEvaluationHistory.and.returnValue(
      of(buildHistory([20]))
    );

    routeParams.next(
      convertToParamMap({ evaluationId: '10' })
    );

    fixture.detectChanges();

    expect(component.evaluationId)
      .toBeNull();

    expect(improvementActionService.getActions)
      .not.toHaveBeenCalled();

    expect(improvementActionService.getProgressMetrics)
      .not.toHaveBeenCalled();

    expect(router.navigate)
      .toHaveBeenCalledOnceWith([
        '/user/improvement/plan'
      ]);

  });


  it('should block plan loading when ownership validation fails', () => {

    evaluationService.getEvaluationHistory.and.returnValue(
      throwError(() => new Error('Request failed'))
    );

    routeParams.next(
      convertToParamMap({ evaluationId: '10' })
    );

    fixture.detectChanges();

    expect(component.evaluationValidationError)
      .toBeTrue();

    expect(component.validatingEvaluation)
      .toBeFalse();

    expect(component.loading)
      .toBeFalse();

    expect(component.evaluationId)
      .toBeNull();

    expect(component.errorMessage)
      .toContain('No fue posible verificar la evaluación');

    expect(improvementActionService.getActions)
      .not.toHaveBeenCalled();

    expect(improvementActionService.getProgressMetrics)
      .not.toHaveBeenCalled();

    expect(router.navigate)
      .not.toHaveBeenCalled();

  });


  it('should retry a failed ownership validation', () => {

    evaluationService.getEvaluationHistory.and.returnValues(

      throwError(() => new Error('Request failed')),

      of(buildHistory([10]))

    );

    routeParams.next(
      convertToParamMap({ evaluationId: '10' })
    );

    expect(component.evaluationValidationError)
      .toBeTrue();

    component.retryEvaluationValidation();

    fixture.detectChanges();

    expect(evaluationService.getEvaluationHistory)
      .toHaveBeenCalledTimes(2);

    expect(component.evaluationValidationError)
      .toBeFalse();

    expect(component.evaluationId)
      .toBe(10);

    expect(improvementActionService.getActions)
      .toHaveBeenCalledOnceWith(10);

  });


  it('should ignore ownership validation after a company change', () => {

    const pendingHistory =
      new Subject<EvaluationHistory>();

    evaluationService.getEvaluationHistory.and.returnValue(
      pendingHistory.asObservable()
    );

    routeParams.next(
      convertToParamMap({ evaluationId: '10' })
    );

    expect(pendingHistory.observed)
      .toBeTrue();

    selectedCompanyId.set(2);

    // Respuesta anterior antes de sincronizar los efectos.

    pendingHistory.next(buildHistory([10]));

    expect(improvementActionService.getActions)
      .not.toHaveBeenCalled();

    expect(improvementActionService.getProgressMetrics)
      .not.toHaveBeenCalled();

    TestBed.flushEffects();

    fixture.detectChanges();

    expect(pendingHistory.observed)
      .toBeFalse();

    expect(component.evaluationId)
      .toBeNull();

  });


  it('should cancel ownership validation when changing evaluations', () => {

    const previousHistory =
      new Subject<EvaluationHistory>();

    evaluationService.getEvaluationHistory.and.returnValues(

      previousHistory.asObservable(),

      of(buildHistory([10, 20]))

    );

    routeParams.next(
      convertToParamMap({ evaluationId: '10' })
    );

    expect(previousHistory.observed)
      .toBeTrue();

    routeParams.next(
      convertToParamMap({ evaluationId: '20' })
    );

    expect(previousHistory.observed)
      .toBeFalse();

    previousHistory.next(buildHistory([10]));

    fixture.detectChanges();

    expect(component.evaluationId)
      .toBe(20);

    expect(improvementActionService.getActions)
      .toHaveBeenCalledOnceWith(20);

    expect(improvementActionService.getProgressMetrics)
      .toHaveBeenCalledOnceWith(20);

  });


  it('should block mutations while validating evaluation ownership', () => {

    const pendingHistory =
      new Subject<EvaluationHistory>();

    evaluationService.getEvaluationHistory.and.returnValue(
      pendingHistory.asObservable()
    );

    routeParams.next(
      convertToParamMap({ evaluationId: '10' })
    );

    component.newAction = {
      indicator_id: null,
      gap_description: 'Brecha de prueba',
      description: 'Acción de prueba',
      priority: 'HIGH',
      responsible: 'Operaciones',
      target_date: '2026-12-15'
    };

    component.editingActionId = 5;

    component.editAction = {
      ...component.newAction,
      status: 'PENDING'
    };

    component.confirmDeleteActionId = 5;

    component.actions = [action];

    component.createAction();

    component.updateAction();

    component.deleteAction();

    expect(component.canExportActions)
      .toBeFalse();

    expect(improvementActionService.createAction)
      .not.toHaveBeenCalled();

    expect(improvementActionService.updateAction)
      .not.toHaveBeenCalled();

    expect(improvementActionService.deleteAction)
      .not.toHaveBeenCalled();

  });

  it('should display the evaluation validation loading state', () => {

    const pendingHistory =
      new Subject<EvaluationHistory>();

    evaluationService.getEvaluationHistory.and.returnValue(
      pendingHistory.asObservable()
    );

    routeParams.next(
      convertToParamMap({ evaluationId: '10' })
    );

    fixture.detectChanges();

    const content: string =
      fixture.nativeElement.textContent;

    expect(content)
      .toContain('Verificando evaluación...');

    expect(content)
      .not.toContain('Nueva acción');

    expect(content)
      .not.toContain('Progreso del plan de mejora');

  });


  it('should retry evaluation validation using the HTML button', () => {

    evaluationService.getEvaluationHistory.and.returnValues(

      throwError(() => new Error('Request failed')),

      of(buildHistory([10]))

    );

    routeParams.next(
      convertToParamMap({ evaluationId: '10' })
    );

    fixture.detectChanges();

    const element: HTMLElement =
      fixture.nativeElement;

    const retryButton =
      Array.from(
        element.querySelectorAll<HTMLButtonElement>(
          'button'
        )
      ).find(button =>
        button.textContent?.includes('Reintentar')
      );

    expect(retryButton).toBeDefined();

    retryButton?.click();

    fixture.detectChanges();

    expect(evaluationService.getEvaluationHistory)
      .toHaveBeenCalledTimes(2);

    expect(component.evaluationValidationError)
      .toBeFalse();

    expect(component.evaluationId)
      .toBe(10);

    expect(improvementActionService.getActions)
      .toHaveBeenCalledOnceWith(10);

  });

});
