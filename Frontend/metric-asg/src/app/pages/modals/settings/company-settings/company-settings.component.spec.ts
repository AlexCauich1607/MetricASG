
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  provideHttpClientTesting,
  HttpTestingController
} from '@angular/common/http/testing';

import { CompanySettingsComponent } from './company-settings.component';
import { CompanyContextService } from '../../../../services/company-context.service';
import { CompanyRole } from '../../../../models/company_membership';

describe('CompanySettingsComponent', () => {
  let component: CompanySettingsComponent;
  let fixture: ComponentFixture<CompanySettingsComponent>;
  let companyContext: CompanyContextService;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanySettingsComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    companyContext = TestBed.inject(CompanyContextService);
    httpMock = TestBed.inject(HttpTestingController);

    companyContext.memberships.set([]);
    companyContext.selectedCompanyId.set(null);

    fixture = TestBed.createComponent(CompanySettingsComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();

    httpMock.match(() => true).forEach(request => {
      if (request.request.url.includes('company-sectors')) {
        request.flush([]);
      } else if (request.request.url.includes('company-sizes')) {
        request.flush([]);
      }
    });
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not allow editing without a selected company', () => {
    expect(component.canEdit()).toBeFalse();
    expect(component.company()).toBeNull();

    component.update();

    const requests = httpMock.match(
      request => request.method === 'PATCH'
    );

    expect(requests.length).toBe(0);
  });

  it('should allow editing only for company administrators', () => {
    companyContext.memberships.set([
      {
        membership_id: 10,
        company_id: 3,
        company_name: 'Empresa ASG',
        role: CompanyRole.COLLABORATOR,
        joined_at: '2026-11-21T10:00:00'
      }
    ]);

    companyContext.selectedCompanyId.set(3);
    fixture.detectChanges();

    expect(component.canEdit()).toBeFalse();

    companyContext.memberships.update(memberships =>
      memberships.map(membership => ({
        ...membership,
        role: CompanyRole.COMPANY_ADMIN
      }))
    );

    fixture.detectChanges();

    expect(component.canEdit()).toBeTrue();

    // La solicitud anterior puede haber sido cancelada
    // cuando cambió el rol de la membresía.
    const requests = httpMock.match(
      request =>
        request.method === 'GET' &&
        request.url === 'http://localhost:8000/api/companies/3'
    );

    requests.forEach(request => {
      if (!request.cancelled) {
        request.flush({
          id: 3,
          name: 'Empresa ASG',
          sector_id: null,
          size_id: null,
          active: true
        });
      }
    });
  });

  it('should update the selected company and refresh memberships', () => {
    const membership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa Original',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-21T10:00:00'
    };

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    component.company.set({
      id: 3,
      name: 'Empresa Original',
      sector_id: 2,
      size_id: 4,
      active: true,
      biannual_evaluation: false,
      next_evaluation: null
    });

    component.name.set('Empresa Actualizada');
    component.sectorId.set(null);
    component.sizeId.set(4);

    component.update();

    const updateRequest = httpMock.expectOne(
      'http://localhost:8000/api/companies/3'
    );

    expect(updateRequest.request.method).toBe('PATCH');

    expect(updateRequest.request.body).toEqual({
      name: 'Empresa Actualizada',
      sector_id: null,
      size_id: 4
    });

    updateRequest.flush({
      id: 3,
      name: 'Empresa Actualizada',
      sector_id: null,
      size_id: 4,
      active: true
    });

    expect(component.company()?.name).toBe('Empresa Actualizada');
    expect(component.saveSuccess()).toBeTrue();

    const membershipsRequest = httpMock.expectOne(
      'http://localhost:8000/api/companies/me/memberships'
    );

    expect(membershipsRequest.request.method).toBe('GET');

    membershipsRequest.flush([
      {
        ...membership,
        company_name: 'Empresa Actualizada'
      }
    ]);

    expect(companyContext.selectedCompanyId()).toBe(3);
    expect(
      companyContext.selectedMembership()?.company_name
    ).toBe('Empresa Actualizada');
  });

  it('should reject company updates from non-admin members', () => {
    companyContext.memberships.set([
      {
        membership_id: 20,
        company_id: 3,
        company_name: 'Empresa ASG',
        role: CompanyRole.COLLABORATOR,
        joined_at: '2026-11-21T10:00:00'
      }
    ]);

    companyContext.selectedCompanyId.set(3);

    component.company.set({
      id: 3,
      name: 'Empresa ASG',
      sector_id: null,
      size_id: null,
      active: true,
      biannual_evaluation: false,
      next_evaluation: null
    });

    component.name.set('Cambio no autorizado');

    expect(component.canEdit()).toBeFalse();

    component.update();

    const patchRequests = httpMock.match(
      request => request.method === 'PATCH'
    );

    expect(patchRequests.length).toBe(0);
    expect(component.saving()).toBeFalse();
    expect(component.saveSuccess()).toBeFalse();

    // Resolver únicamente solicitudes que sigan activas.
    const companyRequests = httpMock.match(
      request =>
        request.method === 'GET' &&
        request.url === 'http://localhost:8000/api/companies/3'
    );

    companyRequests.forEach(request => {
      if (!request.cancelled) {
        request.flush({
          id: 3,
          name: 'Empresa ASG',
          sector_id: null,
          size_id: null,
          active: true
        });
      }
    });
  });

  it('should not apply a previous company update after changing selection', () => {
    const memberships = [
      {
        membership_id: 10,
        company_id: 3,
        company_name: 'Empresa A',
        role: CompanyRole.COMPANY_ADMIN,
        joined_at: '2026-11-21T10:00:00'
      },
      {
        membership_id: 20,
        company_id: 7,
        company_name: 'Empresa B',
        role: CompanyRole.COMPANY_ADMIN,
        joined_at: '2026-11-21T11:00:00'
      }
    ];

    companyContext.memberships.set(memberships);
    companyContext.selectedCompanyId.set(3);

    component.company.set({
      id: 3,
      name: 'Empresa A',
      sector_id: null,
      size_id: null,
      active: true,
      biannual_evaluation: false,
      next_evaluation: null
    });

    component.name.set('Empresa A Actualizada');

    component.update();

    const updateRequest = httpMock.expectOne(
      request =>
        request.method === 'PATCH' &&
        request.url === 'http://localhost:8000/api/companies/3'
    );

    expect(component.saving()).toBeTrue();

    // Cambiar a la empresa B antes de recibir el PATCH.
    companyContext.selectedCompanyId.set(7);
    fixture.detectChanges();

    // La respuesta anterior no debe aplicarse a B.
    expect(component.saveSuccess()).toBeFalse();

    // Resolver las solicitudes GET activas.
    const requests = httpMock.match(
      request =>
        request.method === 'GET' &&
        request.url.startsWith(
          'http://localhost:8000/api/companies/'
        )
    );

    requests.forEach(request => {
      if (request.cancelled) {
        return;
      }

      if (request.request.url.endsWith('/7')) {
        request.flush({
          id: 7,
          name: 'Empresa B',
          sector_id: null,
          size_id: null,
          active: true
        });
      } else {
        request.flush({
          id: 3,
          name: 'Empresa A',
          sector_id: null,
          size_id: null,
          active: true
        });
      }
    });

    expect(component.company()?.id).not.toBe(3);
    expect(component.saveSuccess()).toBeFalse();

    // Si la cancelación ya se procesó, la solicitud
    // anterior no debe seguir modificando el formulario.
    expect(updateRequest.cancelled).toBeTrue();
  });

  it('should show an error when company update fails', () => {
    const membership = {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa Original',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-21T10:00:00'
    };

    companyContext.memberships.set([membership]);
    companyContext.selectedCompanyId.set(3);

    component.company.set({
      id: 3,
      name: 'Empresa Original',
      sector_id: null,
      size_id: null,
      active: true,
      biannual_evaluation: false,
      next_evaluation: null
    });

    component.name.set('Empresa Actualizada');

    component.update();

    const updateRequest = httpMock.expectOne(
      request =>
        request.method === 'PATCH' &&
        request.url === 'http://localhost:8000/api/companies/3'
    );

    expect(component.saving()).toBeTrue();

    updateRequest.flush(
      { detail: 'Company operation rejected' },
      {
        status: 403,
        statusText: 'Forbidden'
      }
    );

    expect(component.saving()).toBeFalse();
    expect(component.saveSuccess()).toBeFalse();
    expect(component.saveError()).toBe(
      'No fue posible actualizar la información de la empresa.'
    );

    expect(component.company()?.name).toBe('Empresa Original');

    // Una actualización fallida no debe refrescar las membresías.
    const membershipRequests = httpMock.match(
      request =>
        request.url ===
        'http://localhost:8000/api/companies/me/memberships'
    );

    expect(membershipRequests.length).toBe(0);
  });

  it('should recover company information after a loading error', async () => {
    companyContext.memberships.set([
      {
        membership_id: 10,
        company_id: 3,
        company_name: 'Empresa ASG',
        role: CompanyRole.COMPANY_ADMIN,
        joined_at: '2026-11-21T10:00:00'
      }
    ]);

    companyContext.selectedCompanyId.set(3);
    fixture.detectChanges();

    const failedRequest = httpMock.expectOne(
      request =>
        request.method === 'GET' &&
        request.url === 'http://localhost:8000/api/companies/3'
    );

    failedRequest.flush(
      { detail: 'Company not found' },
      {
        status: 404,
        statusText: 'Not Found'
      }
    );

    expect(component.error()).toBeTrue();
    expect(component.company()).toBeNull();
    expect(component.loading()).toBeFalse();

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain(
      'No fue posible cargar la información de la empresa.'
    );

    component.retryLoad();

    const retryRequest = httpMock.expectOne(
      request =>
        request.method === 'GET' &&
        request.url === 'http://localhost:8000/api/companies/3'
    );

    expect(retryRequest.request.method).toBe('GET');

    retryRequest.flush({
      id: 3,
      name: 'Empresa ASG',
      sector_id: null,
      size_id: null,
      active: true
    });


    fixture.detectChanges();

    // Esperar a que Angular Forms termine de actualizar ngModel.
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.error()).toBeFalse();
    expect(component.loading()).toBeFalse();
    expect(component.company()?.name).toBe('Empresa ASG');
    expect(component.name()).toBe('Empresa ASG');

    const nameInput = element.querySelector<HTMLInputElement>(
      '#companyName'
    );

    expect(nameInput).not.toBeNull();
    expect(nameInput?.value).toBe('Empresa ASG');

  });

});
