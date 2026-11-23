
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { UserHomeComponent } from './user-home.component';
import { EvaluationService } from '../../../services/evaluation.service';
import { CompanyContextService } from '../../../services/company-context.service';
import { UserService } from '../../../services/user.service';
import { ResultEvaluation } from '../../../models/evaluation_result';

import { CompanyInvitationService } from '../../../services/company-invitation.service';

describe('UserHomeComponent', () => {
  let component: UserHomeComponent;
  let fixture: ComponentFixture<UserHomeComponent>;

  let evaluationService: jasmine.SpyObj<EvaluationService>;
  let userService: jasmine.SpyObj<UserService>;
  let invitationService: jasmine.SpyObj<CompanyInvitationService>;
  let companyContext: CompanyContextService;
  let selectedCompanyId: ReturnType<typeof signal<number | null>>;

  const companyAResults = {
    evaluation_id: 10,
    date: '2026-09-15T12:00:00',
    global_score: 8,
    ambits: [
      {
        ambit_name: 'Ambiental',
        score: 8.5,
        color: '#00AA00',
        maturity_color: '#15b91d'
      }
    ]
  } as ResultEvaluation;

  const companyBResults = {
    evaluation_id: 20,
    date: '2026-10-20T12:00:00',
    global_score: 7,
    ambits: [
      {
        ambit_name: 'Social',
        score: 7.5,
        color: '#0000AA',
        maturity_color: '#eac84f'
      }
    ]
  } as ResultEvaluation;

  beforeEach(async () => {
    selectedCompanyId = signal<number | null>(null);

    evaluationService = jasmine.createSpyObj<EvaluationService>(
      'EvaluationService',
      ['getLastEvaluationResult']
    );

    evaluationService.getLastEvaluationResult.and.returnValue(
      of(companyAResults)
    );

    userService = jasmine.createSpyObj<UserService>(
      'UserService',
      ['getMe']
    );
    invitationService = jasmine.createSpyObj<CompanyInvitationService>(
      'CompanyInvitationService',
      ['acceptInvitation']
    );
    await TestBed.configureTestingModule({
      imports: [UserHomeComponent],
      providers: [
        provideRouter([]),
        {
          provide: EvaluationService,
          useValue: evaluationService
        },
        {
          provide: UserService,
          useValue: userService
        },
        {
          provide: CompanyInvitationService,
          useValue: invitationService
        },
        {
          provide: CompanyContextService,
          useValue: {
            selectedCompanyId,
            memberships: signal([]),
            loading: signal(false),
            error: signal(false),
            refreshMemberships: jasmine.createSpy('refreshMemberships')
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserHomeComponent);
    component = fixture.componentInstance;
    companyContext = TestBed.inject(CompanyContextService);
    // Evitar que la carga del perfil interfiera con estas pruebas.
    spyOn(component, 'loadUser');

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not request results without a selected company', async () => {
    await fixture.whenStable();

    expect(
      evaluationService.getLastEvaluationResult
    ).not.toHaveBeenCalled();

    expect(component.results).toBeNull();
  });



  it('should reload results and chart data when switching companies', () => {
    evaluationService.getLastEvaluationResult.and.returnValues(
      of(companyAResults),
      of(companyBResults)
    );

    selectedCompanyId.set(3);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.results).toEqual(companyAResults);
    expect(component.ambits).toEqual(['Ambiental']);
    expect(component.scores).toEqual([8.5]);

    selectedCompanyId.set(7);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.results).toEqual(companyBResults);
    expect(component.ambits).toEqual(['Social']);
    expect(component.scores).toEqual([7.5]);

    expect(
      evaluationService.getLastEvaluationResult
    ).toHaveBeenCalledTimes(2);
  });



  it('should clear previous results while loading another company', () => {
    const pendingResults = new Subject<ResultEvaluation>();

    evaluationService.getLastEvaluationResult.and.returnValues(
      of(companyAResults),
      pendingResults.asObservable()
    );

    selectedCompanyId.set(3);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.results).toEqual(companyAResults);

    selectedCompanyId.set(7);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.results).toBeNull();
    expect(component.ambits).toEqual([]);
    expect(component.scores).toEqual([]);
    expect(component.loadingChart).toBeFalse();
    expect(component.resultsStatus).toBe('loading');

    pendingResults.next(companyBResults);
    fixture.detectChanges();

    expect(component.results).toEqual(companyBResults);
    expect(component.resultsStatus).toBe('success');

    pendingResults.complete();
  });


  it('should show loading while results are pending', async () => {
    const pendingResults = new Subject<ResultEvaluation>();

    evaluationService.getLastEvaluationResult.and.returnValue(
      pendingResults.asObservable()
    );

    selectedCompanyId.set(3);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.resultsStatus).toBe('loading');
    expect(component.results).toBeNull();

    const state = fixture.nativeElement.querySelector(
      '.asg-state--loading'
    );

    expect(state).not.toBeNull();

    pendingResults.complete();
  });

  it('should show empty when no completed evaluations exist', async () => {
    evaluationService.getLastEvaluationResult.and.returnValue(
      throwError(() => ({
        status: 404,
        error: { detail: 'No evaluations found' }
      }))
    );

    selectedCompanyId.set(3);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.resultsStatus).toBe('empty');
    expect(component.results).toBeNull();

    expect(
      fixture.nativeElement.querySelector('.asg-state--empty')
    ).not.toBeNull();
  });

  it('should show error for service failures', async () => {
    evaluationService.getLastEvaluationResult.and.returnValue(
      throwError(() => ({
        status: 500,
        error: { detail: 'Internal Server Error' }
      }))
    );

    spyOn(console, 'error');

    selectedCompanyId.set(3);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.resultsStatus).toBe('error');
    expect(component.results).toBeNull();

    expect(
      fixture.nativeElement.querySelector('.asg-state--error')
    ).not.toBeNull();
  });

  it('should not treat unrelated 404 errors as empty', async () => {
    evaluationService.getLastEvaluationResult.and.returnValue(
      throwError(() => ({
        status: 404,
        error: { detail: 'Company not found' }
      }))
    );

    spyOn(console, 'error');

    selectedCompanyId.set(3);
    TestBed.tick();
    fixture.detectChanges();

    expect(component.resultsStatus).toBe('error');
  });
  it('should retry membership synchronization without resending the invitation', () => {
    const acceptedMembership = {
      membership_id: 25,
      company_id: 15,
      company_name: 'Empresa Invitada',
      role: 'COLLABORATOR',
      joined_at: '2026-11-23T12:00:00'
    };

    const contextMock = companyContext as unknown as {
      selectedCompanyId: ReturnType<typeof signal<number | null>>;
      memberships: ReturnType<typeof signal<any[]>>;
      error: ReturnType<typeof signal<boolean>>;
      refreshMemberships: jasmine.Spy;
    };

    invitationService.acceptInvitation.and.returnValue(of({}));

    contextMock.refreshMemberships.and.callFake(() => {
      if (contextMock.refreshMemberships.calls.count() === 1) {
        contextMock.error.set(true);
        return of([]);
      }

      contextMock.error.set(false);
      contextMock.memberships.set([acceptedMembership]);
      contextMock.selectedCompanyId.set(15);

      return of([acceptedMembership]);
    });

    component.invitationToken = 'token-de-prueba';
    component.acceptInvitation();

    expect(invitationService.acceptInvitation).toHaveBeenCalledTimes(1);
    expect(contextMock.refreshMemberships).toHaveBeenCalledTimes(1);
    expect(component.invitationAcceptedPendingSync).toBeTrue();
    expect(component.invitationError).toContain('actualizar tus empresas');

    component.syncAcceptedInvitation();

    expect(invitationService.acceptInvitation).toHaveBeenCalledTimes(1);
    expect(contextMock.refreshMemberships).toHaveBeenCalledTimes(2);
    expect(component.invitationAcceptedPendingSync).toBeFalse();
    expect(component.invitationSuccess).toBeTrue();
    expect(contextMock.selectedCompanyId()).toBe(15);
  });
});
