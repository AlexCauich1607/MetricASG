
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { ImprovementPlanComponent } from './improvement-plan.component';
import { ImprovementActionService } from '../../../services/improvement-action.service';
import { ImprovementAction } from '../../../models/improvement_action';

describe('ImprovementPlanComponent', () => {
  let component: ImprovementPlanComponent;
  let fixture: ComponentFixture<ImprovementPlanComponent>;
  let improvementActionService: jasmine.SpyObj<ImprovementActionService>;
  let routeParams: Subject<ReturnType<typeof convertToParamMap>>;

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
        }
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

});
