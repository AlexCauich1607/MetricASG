import { of, Subject, throwError } from 'rxjs';
import { Router } from '@angular/router';
import {
  CompanyMember,
  CompanyMembershipStatus,
  CompanyRole,
  UserCompanyMembership
} from '../../../models/company_membership';
import { CompanyContextService } from '../../../services/company-context.service';
import { CompanyMembershipService } from '../../../services/company-membership.service';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompanyMembersComponent } from './company-members.component';
import { HttpErrorResponse } from '@angular/common/http';
import { CompanyInvitationService } from '../../../services/company-invitation.service';
import { CompanyInvitation } from '../../../models/company_invitation';

describe('CompanyMembersComponent', () => {
  let component: CompanyMembersComponent;
  let fixture: ComponentFixture<CompanyMembersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyMembersComponent],
      providers: [
        {
          provide: Router,
          useValue: jasmine.createSpyObj('Router', ['navigate'])
        }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(CompanyMembersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load members of the selected company', () => {
    const companyContext = TestBed.inject(CompanyContextService);

    const membershipService = TestBed.inject(CompanyMembershipService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const members: CompanyMember[] = [
      {
        membership_id: 10,
        user_id: 5,
        name: 'Ana',
        lastname: 'López',
        email: 'ana@example.com',
        position: 'Gerente',
        role: CompanyRole.COMPANY_ADMIN,
        status: CompanyMembershipStatus.ACTIVE,
        joined_at: '2026-11-09T10:00:00'
      }
    ];

    const getMembersSpy = spyOn(
      membershipService,
      'getMembers'
    ).and.returnValue(of(members));

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(getMembersSpy).toHaveBeenCalledOnceWith(3);
    expect(component.members()).toEqual(members);
    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeFalse();

    const content: string = fixture.nativeElement.textContent;

    expect(content).toContain('Ana');
    expect(content).toContain('ana@example.com');
  });

  it('should cancel the previous members request when switching companies', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);

    const pendingRequest = new Subject<CompanyMember[]>();

    const companyA: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const companyB: UserCompanyMembership = {
      membership_id: 18,
      company_id: 7,
      company_name: 'Empresa B',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:30:00'
    };

    const membersB: CompanyMember[] = [
      {
        membership_id: 20,
        user_id: 12,
        name: 'Carlos',
        lastname: 'Pérez',
        email: 'carlos@example.com',
        position: 'Responsable ASG',
        role: CompanyRole.ASG_MANAGER,
        status: CompanyMembershipStatus.ACTIVE,
        joined_at: '2026-11-09T11:00:00'
      }
    ];

    const getMembersSpy = spyOn(
      membershipService,
      'getMembers'
    ).and.callFake(companyId =>
      companyId === 3
        ? pendingRequest.asObservable()
        : of(membersB)
    );

    companyContext.memberships.set([companyA, companyB]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(getMembersSpy).toHaveBeenCalledOnceWith(3);
    expect(pendingRequest.observed).toBeTrue();

    // Cambiar de empresa antes de recibir la primera respuesta.
    companyContext.selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // La consulta anterior debe quedar cancelada.
    expect(pendingRequest.observed).toBeFalse();
    expect(getMembersSpy).toHaveBeenCalledWith(7);

    // Únicamente deben conservarse los miembros de Empresa B.
    expect(component.members()).toEqual(membersB);

    const content: string = fixture.nativeElement.textContent;

    expect(content).toContain('carlos@example.com');
    expect(content).not.toContain('Empresa A');
  });

  it('should cancel members request when company admin permissions are revoked', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);

    const pendingRequest = new Subject<CompanyMember[]>();

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const getMembersSpy = spyOn(
      membershipService,
      'getMembers'
    ).and.returnValue(pendingRequest.asObservable());

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(getMembersSpy).toHaveBeenCalledOnceWith(3);
    expect(pendingRequest.observed).toBeTrue();

    // Revocar el rol de administrador empresarial.
    companyContext.memberships.set([
      {
        ...membership,
        role: CompanyRole.AUDITOR
      }
    ]);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // La consulta anterior debe cancelarse.
    expect(pendingRequest.observed).toBeFalse();

    // No deben permanecer datos de miembros en el componente.
    expect(component.members()).toEqual([]);
    expect(component.loading()).toBeFalse();
    expect(component.error()).toBeFalse();

    // No deben iniciarse nuevas consultas sin autorización.
    expect(getMembersSpy).toHaveBeenCalledTimes(1);
  });

  it('should display an access restriction message when admin permissions are revoked', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const members: CompanyMember[] = [
      {
        membership_id: 10,
        user_id: 5,
        name: 'Ana',
        lastname: 'López',
        email: 'ana@example.com',
        position: 'Gerente',
        role: CompanyRole.COMPANY_ADMIN,
        status: CompanyMembershipStatus.ACTIVE,
        joined_at: '2026-11-09T10:00:00'
      }
    ];

    const getMembersSpy = spyOn(
      membershipService,
      'getMembers'
    ).and.returnValue(of(members));

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    let content: string = fixture.nativeElement.textContent;

    expect(content).toContain('ana@example.com');

    // Revocar los permisos de administración.
    companyContext.memberships.set([
      {
        ...membership,
        role: CompanyRole.AUDITOR
      }
    ]);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    content = fixture.nativeElement.textContent;

    expect(content).toContain(
      'No tienes permisos para administrar los miembros'
    );

    expect(content).not.toContain('ana@example.com');
    expect(component.members()).toEqual([]);

    // No deben realizarse consultas adicionales.
    expect(getMembersSpy).toHaveBeenCalledTimes(1);
  });

  it('should display an error when company members cannot be loaded', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const getMembersSpy = spyOn(
      membershipService,
      'getMembers'
    ).and.returnValue(
      throwError(() => new Error('Network error'))
    );

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(getMembersSpy).toHaveBeenCalledOnceWith(3);

    expect(component.error()).toBeTrue();
    expect(component.loading()).toBeFalse();
    expect(component.members()).toEqual([]);

    const content: string = fixture.nativeElement.textContent;

    expect(content).toContain(
      'No fue posible recuperar los miembros de la empresa.'
    );
  });

  it('should retry loading company members after an HTTP error', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const members: CompanyMember[] = [
      {
        membership_id: 10,
        user_id: 5,
        name: 'Ana',
        lastname: 'López',
        email: 'ana@example.com',
        position: 'Gerente',
        role: CompanyRole.COMPANY_ADMIN,
        status: CompanyMembershipStatus.ACTIVE,
        joined_at: '2026-11-09T10:00:00'
      }
    ];

    const getMembersSpy = spyOn(
      membershipService,
      'getMembers'
    ).and.returnValues(
      throwError(() => new Error('Network error')),
      of(members)
    );

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // La primera consulta falla.
    expect(component.error()).toBeTrue();
    expect(component.members()).toEqual([]);


    const element: HTMLElement = fixture.nativeElement;

    const retryButton: HTMLButtonElement | undefined =
      Array.from(element.querySelectorAll('button'))
        .find(button =>
          button.textContent?.includes('Reintentar')
        );


    expect(retryButton).not.toBeNull();

    // El usuario solicita un nuevo intento.
    retryButton!.click();

    fixture.detectChanges();

    // La segunda consulta se completa correctamente.
    expect(getMembersSpy).toHaveBeenCalledTimes(2);
    expect(getMembersSpy).toHaveBeenCalledWith(3);

    expect(component.error()).toBeFalse();
    expect(component.loading()).toBeFalse();
    expect(component.members()).toEqual(members);

    const content: string = fixture.nativeElement.textContent;

    expect(content).toContain('ana@example.com');
    expect(content).not.toContain(
      'No fue posible recuperar los miembros de la empresa.'
    );
  });

  it('should retry only for the currently selected company', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);

    const companyA: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const companyB: UserCompanyMembership = {
      membership_id: 18,
      company_id: 7,
      company_name: 'Empresa B',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:30:00'
    };

    const getMembersSpy = spyOn(
      membershipService,
      'getMembers'
    ).and.returnValue(of([]));

    companyContext.memberships.set([companyA, companyB]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(getMembersSpy).toHaveBeenCalledOnceWith(3);

    // Cambiar a Empresa B.
    companyContext.selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(getMembersSpy).toHaveBeenCalledWith(7);

    // Solicitar un reintento sobre la empresa activa.
    component.retryLoadMembers();

    fixture.detectChanges();

    expect(getMembersSpy).toHaveBeenCalledTimes(3);

    // Verificar que la última solicitud utiliza Empresa B.
    expect(getMembersSpy.calls.mostRecent().args).toEqual([7]);
  });

  it('should prevent retrying members requests after admin permissions are revoked', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const getMembersSpy = spyOn(
      membershipService,
      'getMembers'
    ).and.returnValue(of([]));

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(getMembersSpy).toHaveBeenCalledOnceWith(3);

    // Revocar los permisos administrativos.
    companyContext.memberships.set([
      {
        ...membership,
        role: CompanyRole.AUDITOR
      }
    ]);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // Intentar consultar nuevamente los integrantes.
    component.retryLoadMembers();

    fixture.detectChanges();

    // No debe ejecutarse ninguna consulta adicional.
    expect(getMembersSpy).toHaveBeenCalledTimes(1);
    expect(component.members()).toEqual([]);

    const content: string = fixture.nativeElement.textContent;

    expect(content).toContain(
      'No tienes permisos para administrar los miembros'
    );
  });

  it('should remove a company member after confirmation', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const members: CompanyMember[] = [
      {
        membership_id: 10,
        user_id: 5,
        name: 'Ana',
        lastname: 'López',
        email: 'ana@example.com',
        position: 'Gerente',
        role: CompanyRole.COMPANY_ADMIN,
        status: CompanyMembershipStatus.ACTIVE,
        joined_at: '2026-11-09T10:00:00'
      },
      {
        membership_id: 18,
        user_id: 8,
        name: 'Carlos',
        lastname: 'Pérez',
        email: 'carlos@example.com',
        position: 'Colaborador',
        role: CompanyRole.COLLABORATOR,
        status: CompanyMembershipStatus.ACTIVE,
        joined_at: '2026-11-09T11:00:00'
      }
    ];

    spyOn(membershipService, 'getMembers')
      .and.returnValue(of(members));

    const removeSpy = spyOn(
      membershipService,
      'removeMember'
    ).and.returnValue(of(void 0));

    const confirmSpy = spyOn(window, 'confirm')
      .and.returnValue(true);

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(component.members().length).toBe(2);

    // Eliminar al colaborador.
    component.removeMember(members[1]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalledOnceWith(3, 18);

    // La lista debe actualizarse después de la respuesta exitosa.
    expect(component.members().length).toBe(1);
    expect(component.members()[0].membership_id).toBe(10);

    expect(component.removingMemberId()).toBeNull();
    expect(component.removeError()).toBeFalse();
  });

  it('should not remove a company member when confirmation is cancelled', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const members: CompanyMember[] = [
      {
        membership_id: 18,
        user_id: 8,
        name: 'Carlos',
        lastname: 'Pérez',
        email: 'carlos@example.com',
        position: 'Colaborador',
        role: CompanyRole.COLLABORATOR,
        status: CompanyMembershipStatus.ACTIVE,
        joined_at: '2026-11-09T11:00:00'
      }
    ];

    spyOn(membershipService, 'getMembers')
      .and.returnValue(of(members));

    const removeSpy = spyOn(
      membershipService,
      'removeMember'
    ).and.returnValue(of(void 0));

    const confirmSpy = spyOn(window, 'confirm')
      .and.returnValue(false);

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    component.removeMember(members[0]);

    expect(confirmSpy).toHaveBeenCalled();
    expect(removeSpy).not.toHaveBeenCalled();

    expect(component.members()).toEqual(members);
    expect(component.removingMemberId()).toBeNull();
    expect(component.removeError()).toBeFalse();
  });

  it('should preserve members when removal fails', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const members: CompanyMember[] = [
      {
        membership_id: 18,
        user_id: 8,
        name: 'Carlos',
        lastname: 'Pérez',
        email: 'carlos@example.com',
        position: 'Colaborador',
        role: CompanyRole.COLLABORATOR,
        status: CompanyMembershipStatus.ACTIVE,
        joined_at: '2026-11-09T11:00:00'
      }
    ];

    spyOn(membershipService, 'getMembers')
      .and.returnValue(of(members));

    const removeSpy = spyOn(
      membershipService,
      'removeMember'
    ).and.returnValue(
      throwError(() => new Error('Network error'))
    );

    spyOn(window, 'confirm').and.returnValue(true);

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    component.removeMember(members[0]);

    expect(removeSpy).toHaveBeenCalledOnceWith(3, 18);

    // El miembro debe permanecer en la lista.
    expect(component.members()).toEqual(members);

    // Se debe registrar el error de eliminación.
    expect(component.removeError()).toBeTrue();

    // El estado de operación debe liberarse.
    expect(component.removingMemberId()).toBeNull();
  });

  it('should cancel a pending removal when switching companies', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);

    const companyA: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const companyB: UserCompanyMembership = {
      membership_id: 20,
      company_id: 7,
      company_name: 'Empresa B',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T11:00:00'
    };

    const memberA: CompanyMember = {
      membership_id: 18,
      user_id: 8,
      name: 'Carlos',
      lastname: 'Pérez',
      email: 'carlos@example.com',
      position: 'Colaborador',
      role: CompanyRole.COLLABORATOR,
      status: CompanyMembershipStatus.ACTIVE,
      joined_at: '2026-11-09T11:00:00'
    };

    const memberB: CompanyMember = {
      ...memberA,
      membership_id: 30,
      user_id: 12,
      name: 'Ana',
      email: 'ana@example.com'
    };

    const pendingRemoval = new Subject<void>();

    spyOn(membershipService, 'getMembers').and.callFake(
      companyId => of(companyId === 3 ? [memberA] : [memberB])
    );

    const removeSpy = spyOn(
      membershipService,
      'removeMember'
    ).and.returnValue(pendingRemoval.asObservable());

    spyOn(window, 'confirm').and.returnValue(true);

    companyContext.memberships.set([companyA, companyB]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    component.removeMember(memberA);

    expect(removeSpy).toHaveBeenCalledOnceWith(3, 18);
    expect(pendingRemoval.observed).toBeTrue();
    expect(component.removingMemberId()).toBe(18);

    // Cambiar de empresa mientras la eliminación está pendiente.
    companyContext.selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // La operación anterior debe quedar cancelada.
    expect(pendingRemoval.observed).toBeFalse();
    expect(component.removingMemberId()).toBeNull();

    // La nueva empresa conserva exclusivamente sus integrantes.
    expect(component.members()).toEqual([memberB]);

    // Una respuesta tardía no debe modificar la lista.
    pendingRemoval.next();
    pendingRemoval.complete();

    expect(component.members()).toEqual([memberB]);
  });

  it('should cancel a pending removal when admin permissions are revoked', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const member: CompanyMember = {
      membership_id: 18,
      user_id: 8,
      name: 'Carlos',
      lastname: 'Pérez',
      email: 'carlos@example.com',
      position: 'Colaborador',
      role: CompanyRole.COLLABORATOR,
      status: CompanyMembershipStatus.ACTIVE,
      joined_at: '2026-11-09T11:00:00'
    };

    const pendingRemoval = new Subject<void>();

    spyOn(membershipService, 'getMembers')
      .and.returnValue(of([member]));

    const removeSpy = spyOn(
      membershipService,
      'removeMember'
    ).and.returnValue(pendingRemoval.asObservable());

    spyOn(window, 'confirm').and.returnValue(true);

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    component.removeMember(member);

    expect(removeSpy).toHaveBeenCalledOnceWith(3, 18);
    expect(pendingRemoval.observed).toBeTrue();
    expect(component.removingMemberId()).toBe(18);

    // Revocar los permisos de administración.
    companyContext.memberships.set([
      {
        ...membership,
        role: CompanyRole.AUDITOR
      }
    ]);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // La operación debe quedar cancelada.
    expect(pendingRemoval.observed).toBeFalse();
    expect(component.removingMemberId()).toBeNull();

    // La lista debe limpiarse y no mostrar integrantes.
    expect(component.members()).toEqual([]);

    // Una respuesta tardía no debe modificar el estado.
    pendingRemoval.next();
    pendingRemoval.complete();

    expect(component.members()).toEqual([]);
    expect(removeSpy).toHaveBeenCalledTimes(1);

    const content: string = fixture.nativeElement.textContent;

    expect(content).toContain(
      'No tienes permisos para administrar los miembros'
    );
  });

  it('should disable removal buttons while a member is being removed', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const members: CompanyMember[] = [
      {
        membership_id: 10,
        user_id: 5,
        name: 'Ana',
        lastname: 'López',
        email: 'ana@example.com',
        position: 'Gerente',
        role: CompanyRole.COMPANY_ADMIN,
        status: CompanyMembershipStatus.ACTIVE,
        joined_at: '2026-11-09T10:00:00'
      },
      {
        membership_id: 18,
        user_id: 8,
        name: 'Carlos',
        lastname: 'Pérez',
        email: 'carlos@example.com',
        position: 'Colaborador',
        role: CompanyRole.COLLABORATOR,
        status: CompanyMembershipStatus.ACTIVE,
        joined_at: '2026-11-09T11:00:00'
      }
    ];

    const pendingRemoval = new Subject<void>();

    spyOn(membershipService, 'getMembers')
      .and.returnValue(of(members));

    const removeSpy = spyOn(
      membershipService,
      'removeMember'
    ).and.returnValue(pendingRemoval.asObservable());

    spyOn(window, 'confirm').and.returnValue(true);

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    const buttons = element.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Eliminar a "]'
    );

    expect(buttons.length).toBe(2);

    // Iniciar la eliminación desde el botón.
    buttons[1].click();

    fixture.detectChanges();

    expect(removeSpy).toHaveBeenCalledOnceWith(3, 18);
    expect(component.removingMemberId()).toBe(18);

    // Todos los botones deben permanecer deshabilitados.
    const updatedButtons =
      element.querySelectorAll<HTMLButtonElement>(
        'button[aria-label^="Eliminar a "]'
      );

    expect(updatedButtons[0].disabled).toBeTrue();
    expect(updatedButtons[1].disabled).toBeTrue();

    expect(updatedButtons[1].textContent)
      .toContain('Eliminando');

    // Completar la eliminación.
    pendingRemoval.next();
    pendingRemoval.complete();

    fixture.detectChanges();

    expect(component.removingMemberId()).toBeNull();
    expect(component.members().length).toBe(1);
    expect(component.members()[0].membership_id).toBe(10);
  });

  it('should display specific messages for membership removal conflicts', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const member: CompanyMember = {
      membership_id: 18,
      user_id: 8,
      name: 'Carlos',
      lastname: 'Pérez',
      email: 'carlos@example.com',
      position: 'Administrador',
      role: CompanyRole.COMPANY_ADMIN,
      status: CompanyMembershipStatus.ACTIVE,
      joined_at: '2026-11-09T11:00:00'
    };

    spyOn(membershipService, 'getMembers')
      .and.returnValue(of([member]));

    const removeSpy = spyOn(
      membershipService,
      'removeMember'
    );

    spyOn(window, 'confirm').and.returnValue(true);

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    const scenarios = [
      {
        detail: 'Cannot remove the last active company administrator',
        message: 'No puedes eliminar al último administrador activo'
      },
      {
        detail: 'Cannot remove the last active company member',
        message: 'No puedes eliminar al último integrante activo'
      }
    ];

    for (const scenario of scenarios) {
      removeSpy.and.returnValue(
        throwError(() => new HttpErrorResponse({
          status: 409,
          error: { detail: scenario.detail }
        }))
      );

      component.removeMember(member);
      fixture.detectChanges();

      expect(removeSpy).toHaveBeenCalledWith(3, 18);
      expect(component.removeError()).toBeTrue();
      expect(component.removeErrorMessage())
        .toContain(scenario.message);

      const content: string = fixture.nativeElement.textContent;

      expect(content).toContain(scenario.message);

      // La operación fallida no debe eliminar al integrante.
      expect(component.members()).toEqual([member]);
      expect(component.removingMemberId()).toBeNull();
    }

    expect(removeSpy).toHaveBeenCalledTimes(2);
  });

  it('should update company context after removing own membership', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);
    const router = TestBed.inject(Router);

    const companyA: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const companyB: UserCompanyMembership = {
      membership_id: 20,
      company_id: 7,
      company_name: 'Empresa B',
      role: CompanyRole.AUDITOR,
      joined_at: '2026-11-09T11:00:00'
    };

    const currentMember: CompanyMember = {
      membership_id: 10,
      user_id: 5,
      name: 'Ana',
      lastname: 'López',
      email: 'ana@example.com',
      position: 'Administrador',
      role: CompanyRole.COMPANY_ADMIN,
      status: CompanyMembershipStatus.ACTIVE,
      joined_at: '2026-11-09T10:00:00'
    };

    spyOn(membershipService, 'getMembers')
      .and.returnValue(of([currentMember]));

    const removeSpy = spyOn(
      membershipService,
      'removeMember'
    ).and.returnValue(of(void 0));

    spyOn(window, 'confirm').and.returnValue(true);

    companyContext.memberships.set([companyA, companyB]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(companyContext.selectedRole())
      .toBe(CompanyRole.COMPANY_ADMIN);

    // Eliminar la membresía del usuario autenticado.
    component.removeMember(currentMember);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(removeSpy).toHaveBeenCalledOnceWith(3, 10);

    // La membresía eliminada ya no debe existir.
    expect(companyContext.memberships()).toEqual([companyB]);

    // Se selecciona otra empresa disponible.
    expect(companyContext.selectedCompanyId()).toBe(7);

    // Se actualiza el rol de acuerdo con la nueva empresa.
    expect(companyContext.selectedRole())
      .toBe(CompanyRole.AUDITOR);

    // El componente ya no debe mostrar miembros sin permisos.
    expect(component.members()).toEqual([]);
    expect(component.removingMemberId()).toBeNull();

    expect(router.navigate).toHaveBeenCalledWith(['/user/home']);
  });

  it('should not navigate when removing another company member', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);
    const router = TestBed.inject(Router);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const members: CompanyMember[] = [
      {
        membership_id: 10,
        user_id: 5,
        name: 'Ana',
        lastname: 'López',
        email: 'ana@example.com',
        position: 'Administrador',
        role: CompanyRole.COMPANY_ADMIN,
        status: CompanyMembershipStatus.ACTIVE,
        joined_at: '2026-11-09T10:00:00'
      },
      {
        membership_id: 18,
        user_id: 8,
        name: 'Carlos',
        lastname: 'Pérez',
        email: 'carlos@example.com',
        position: 'Colaborador',
        role: CompanyRole.COLLABORATOR,
        status: CompanyMembershipStatus.ACTIVE,
        joined_at: '2026-11-09T11:00:00'
      }
    ];

    spyOn(membershipService, 'getMembers')
      .and.returnValue(of(members));

    const removeSpy = spyOn(
      membershipService,
      'removeMember'
    ).and.returnValue(of(void 0));

    spyOn(window, 'confirm').and.returnValue(true);

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    // Eliminar a otro integrante.
    component.removeMember(members[1]);

    fixture.detectChanges();

    expect(removeSpy).toHaveBeenCalledOnceWith(3, 18);

    // El administrador conserva su empresa y sus permisos.
    expect(companyContext.memberships()).toEqual([membership]);
    expect(companyContext.selectedCompanyId()).toBe(3);
    expect(companyContext.selectedRole())
      .toBe(CompanyRole.COMPANY_ADMIN);

    // La lista se actualiza correctamente.
    expect(component.members()).toEqual([members[0]]);

    // No debe producirse ninguna redirección.
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should send an invitation with the selected company role', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);
    const invitationService = TestBed.inject(CompanyInvitationService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    spyOn(membershipService, 'getMembers').and.returnValue(of([]));

    const invitation: CompanyInvitation = {
      id: 100,
      company_id: 3,
      invited_by_user_id: 5,
      email: 'nuevo@example.com',
      role: CompanyRole.ASG_MANAGER,
      status: 'PENDING',
      created_at: '2026-11-11T10:00:00Z',
      expires_at: '2026-11-18T10:00:00Z',
      accepted_at: null,
      last_resent_at: null
    };

    const createInvitationSpy = spyOn(
      invitationService,
      'createInvitation'
    ).and.returnValue(of(invitation));

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    component.invitationEmail.set(' nuevo@example.com ');
    component.invitationRole.set(CompanyRole.ASG_MANAGER);

    component.sendInvitation();

    expect(createInvitationSpy).toHaveBeenCalledOnceWith({
      company_id: 3,
      email: 'nuevo@example.com',
      role: CompanyRole.ASG_MANAGER
    });

    expect(component.invitationSuccess()).toBeTrue();
    expect(component.invitationErrorMessage()).toBeNull();
    expect(component.invitationEmail()).toBe('');
    expect(component.invitationRole()).toBe(
      CompanyRole.COLLABORATOR
    );

    fixture.detectChanges();

    const content: string = fixture.nativeElement.textContent;

    expect(content).toContain(
      'La invitación se envió correctamente.'
    );
  });

  it('should prevent duplicate invitation submissions while sending', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);
    const invitationService = TestBed.inject(CompanyInvitationService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    spyOn(membershipService, 'getMembers').and.returnValue(of([]));

    const pendingRequest = new Subject<CompanyInvitation>();

    const createInvitationSpy = spyOn(
      invitationService,
      'createInvitation'
    ).and.returnValue(pendingRequest.asObservable());

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    component.invitationEmail.set('nuevo@example.com');
    component.invitationRole.set(CompanyRole.AUDITOR);

    component.sendInvitation();

    expect(component.sendingInvitation()).toBeTrue();
    expect(createInvitationSpy).toHaveBeenCalledTimes(1);

    // Intentar enviar nuevamente mientras la solicitud sigue activa.
    component.sendInvitation();

    expect(createInvitationSpy).toHaveBeenCalledTimes(1);

    fixture.detectChanges();

    const submitButton: HTMLButtonElement =
      fixture.nativeElement.querySelector(
        'button[type="submit"]'
      );

    expect(submitButton.disabled).toBeTrue();
    expect(submitButton.textContent).toContain('Enviando...');

    // Simular la finalización de la solicitud.
    pendingRequest.complete();

    expect(component.sendingInvitation()).toBeFalse();
  });

  it('should prevent non-admin users from sending invitations', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const invitationService = TestBed.inject(CompanyInvitationService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COLLABORATOR,
      joined_at: '2026-11-09T10:00:00'
    };

    const createInvitationSpy = spyOn(
      invitationService,
      'createInvitation'
    );

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    component.invitationEmail.set('nuevo@example.com');
    component.invitationRole.set(CompanyRole.ASG_MANAGER);

    component.sendInvitation();

    expect(createInvitationSpy).not.toHaveBeenCalled();
    expect(component.sendingInvitation()).toBeFalse();
    expect(component.invitationSuccess()).toBeFalse();

    const form: HTMLFormElement | null =
      fixture.nativeElement.querySelector('form');

    expect(form).toBeNull();

    const content: string = fixture.nativeElement.textContent;

    expect(content).toContain(
      'No tienes permisos para administrar los miembros de esta empresa.'
    );
  });

  it('should cancel a pending invitation when switching companies', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);
    const invitationService = TestBed.inject(CompanyInvitationService);

    const companyA: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    const companyB: UserCompanyMembership = {
      membership_id: 20,
      company_id: 7,
      company_name: 'Empresa B',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T11:00:00'
    };

    spyOn(membershipService, 'getMembers').and.returnValue(of([]));

    const pendingRequest = new Subject<CompanyInvitation>();

    const createInvitationSpy = spyOn(
      invitationService,
      'createInvitation'
    ).and.returnValue(pendingRequest.asObservable());

    companyContext.memberships.set([companyA, companyB]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    component.invitationEmail.set('nuevo@example.com');
    component.invitationRole.set(CompanyRole.ASG_MANAGER);

    component.sendInvitation();

    expect(createInvitationSpy).toHaveBeenCalledOnceWith({
      company_id: 3,
      email: 'nuevo@example.com',
      role: CompanyRole.ASG_MANAGER
    });

    expect(pendingRequest.observed).toBeTrue();
    expect(component.sendingInvitation()).toBeTrue();

    // Cambiar de empresa antes de recibir la respuesta.
    companyContext.selectedCompanyId.set(7);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    expect(pendingRequest.observed).toBeFalse();
    expect(component.sendingInvitation()).toBeFalse();

    expect(component.invitationEmail()).toBe('');
    expect(component.invitationRole()).toBe(
      CompanyRole.COLLABORATOR
    );
    expect(component.invitationSuccess()).toBeFalse();
    expect(component.invitationErrorMessage()).toBeNull();

    // Una respuesta tardía no debe modificar el nuevo contexto.
    pendingRequest.next({
      id: 100,
      company_id: 3,
      invited_by_user_id: 5,
      email: 'nuevo@example.com',
      role: CompanyRole.ASG_MANAGER,
      status: 'PENDING',
      created_at: '2026-11-11T10:00:00Z',
      expires_at: '2026-11-18T10:00:00Z',
      accepted_at: null,
      last_resent_at: null
    });

    expect(component.invitationSuccess()).toBeFalse();
  });

  it('should handle invitation HTTP errors and allow retrying', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);
    const invitationService = TestBed.inject(CompanyInvitationService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    spyOn(membershipService, 'getMembers').and.returnValue(of([]));

    const createInvitationSpy = spyOn(
      invitationService,
      'createInvitation'
    ).and.returnValues(
      throwError(() => new HttpErrorResponse({
        status: 409,
        error: {
          detail: 'Invitation already pending'
        }
      })),
      of({
        id: 100,
        company_id: 3,
        invited_by_user_id: 5,
        email: 'nuevo@example.com',
        role: CompanyRole.AUDITOR,
        status: 'PENDING' as const,
        created_at: '2026-11-11T10:00:00Z',
        expires_at: '2026-11-18T10:00:00Z',
        accepted_at: null,
        last_resent_at: null
      })
    );

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    component.invitationEmail.set('nuevo@example.com');
    component.invitationRole.set(CompanyRole.AUDITOR);

    // Primer intento: error HTTP 409.
    component.sendInvitation();

    expect(component.invitationSuccess()).toBeFalse();
    expect(component.sendingInvitation()).toBeFalse();
    expect(component.invitationErrorMessage()).toContain(
      'existe un conflicto'
    );

    // El formulario debe conservar sus valores.
    expect(component.invitationEmail()).toBe('nuevo@example.com');
    expect(component.invitationRole()).toBe(CompanyRole.AUDITOR);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'existe un conflicto'
    );

    // Segundo intento: respuesta exitosa.
    component.sendInvitation();

    expect(createInvitationSpy).toHaveBeenCalledTimes(2);
    expect(component.invitationSuccess()).toBeTrue();
    expect(component.invitationErrorMessage()).toBeNull();
    expect(component.invitationEmail()).toBe('');
    expect(component.invitationRole()).toBe(
      CompanyRole.COLLABORATOR
    );
  });

  it('should reject invalid invitation email addresses', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);
    const invitationService = TestBed.inject(CompanyInvitationService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    spyOn(membershipService, 'getMembers').and.returnValue(of([]));

    const createInvitationSpy = spyOn(
      invitationService,
      'createInvitation'
    );

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    component.invitationEmail.set('correo-invalido');
    component.invitationRole.set(CompanyRole.COLLABORATOR);

    component.sendInvitation();

    expect(createInvitationSpy).not.toHaveBeenCalled();
    expect(component.sendingInvitation()).toBeFalse();
    expect(component.invitationSuccess()).toBeFalse();
  });

  [
    {
      status: 403,
      expectedMessage:
        'No tienes permisos para enviar invitaciones a esta empresa.'
    },
    {
      status: 404,
      expectedMessage:
        'No se encontró la empresa o el usuario indicado.'
    },
    {
      status: 500,
      expectedMessage:
        'No fue posible enviar la invitación. Inténtalo nuevamente.'
    }
  ].forEach(({ status, expectedMessage }) => {
    it(`should display the correct invitation error for HTTP ${status}`, () => {
      const companyContext = TestBed.inject(CompanyContextService);
      const membershipService = TestBed.inject(CompanyMembershipService);
      const invitationService = TestBed.inject(CompanyInvitationService);

      const membership: UserCompanyMembership = {
        membership_id: 10,
        company_id: 3,
        company_name: 'Empresa A',
        role: CompanyRole.COMPANY_ADMIN,
        joined_at: '2026-11-09T10:00:00'
      };

      spyOn(membershipService, 'getMembers').and.returnValue(of([]));

      const createInvitationSpy = spyOn(
        invitationService,
        'createInvitation'
      ).and.returnValue(
        throwError(() => new HttpErrorResponse({ status }))
      );

      companyContext.memberships.set([membership]);
      companyContext.selectedCompanyId.set(3);

      fixture.detectChanges();
      TestBed.flushEffects();
      fixture.detectChanges();

      component.invitationEmail.set('nuevo@example.com');
      component.sendInvitation();

      expect(createInvitationSpy).toHaveBeenCalledOnceWith({
        company_id: 3,
        email: 'nuevo@example.com',
        role: CompanyRole.COLLABORATOR
      });

      expect(component.invitationSuccess()).toBeFalse();
      expect(component.sendingInvitation()).toBeFalse();
      expect(component.invitationErrorMessage()).toBe(expectedMessage);

      fixture.detectChanges();

      const content: string = fixture.nativeElement.textContent;
      expect(content).toContain(expectedMessage);
    });
  });

  it('should submit an invitation using the HTML form', () => {
    const companyContext = TestBed.inject(CompanyContextService);
    const membershipService = TestBed.inject(CompanyMembershipService);
    const invitationService = TestBed.inject(CompanyInvitationService);

    const membership: UserCompanyMembership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    };

    spyOn(membershipService, 'getMembers').and.returnValue(of([]));

    const createInvitationSpy = spyOn(
      invitationService,
      'createInvitation'
    ).and.returnValue(of({
      id: 100,
      company_id: 3,
      invited_by_user_id: 5,
      email: 'nuevo@example.com',
      role: CompanyRole.AUDITOR,
      status: 'PENDING',
      created_at: '2026-11-11T10:00:00Z',
      expires_at: '2026-11-18T10:00:00Z',
      accepted_at: null,
      last_resent_at: null
    }));

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    fixture.detectChanges();
    TestBed.flushEffects();
    fixture.detectChanges();

    const emailInput: HTMLInputElement =
      fixture.nativeElement.querySelector('#invitationEmail');

    const roleSelect: HTMLSelectElement =
      fixture.nativeElement.querySelector('#invitationRole');

    const form: HTMLFormElement =
      fixture.nativeElement.querySelector('form');

    expect(emailInput).not.toBeNull();
    expect(roleSelect).not.toBeNull();
    expect(form).not.toBeNull();

    emailInput.value = 'nuevo@example.com';
    emailInput.dispatchEvent(new Event('input'));

    roleSelect.value = CompanyRole.AUDITOR;
    roleSelect.dispatchEvent(new Event('change'));

    fixture.detectChanges();

    expect(component.invitationEmail()).toBe('nuevo@example.com');
    expect(component.invitationRole()).toBe(CompanyRole.AUDITOR);

    form.dispatchEvent(
      new Event('submit', {
        bubbles: true,
        cancelable: true
      })
    );

    expect(createInvitationSpy).toHaveBeenCalledOnceWith({
      company_id: 3,
      email: 'nuevo@example.com',
      role: CompanyRole.AUDITOR
    });

    expect(component.invitationSuccess()).toBeTrue();

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'La invitación se envió correctamente.'
    );
  });

});
