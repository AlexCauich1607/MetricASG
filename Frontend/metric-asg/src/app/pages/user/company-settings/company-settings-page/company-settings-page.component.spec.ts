
import {
  ComponentFixture,
  TestBed
} from '@angular/core/testing';

import {
  Component,
  computed,
  signal
} from '@angular/core';

import { MatDialog } from '@angular/material/dialog';

import {
  of,
  Subject,
  throwError
} from 'rxjs';

import { CompanySettingsPageComponent } from
  './company-settings-page.component';

import { CompanyMembersComponent } from
  '../../company-members/company-members.component';

import { CompanyContextService } from
  '../../../../services/company-context.service';

import { CompanyMembershipService } from
  '../../../../services/company-membership.service';

import { CompanySectorService } from
  '../../../../services/company-sector.service';

import { CompanySizeService } from
  '../../../../services/company-size.service';

import {
  CompanyDetailResponse,
  CompanyRole,
  UserCompanyMembership
} from '../../../../models/company_membership';

import { CompanySector } from
  '../../../../models/company_sector';

import { CompanySize } from
  '../../../../models/company_size';


@Component({
  selector: 'app-company-members',
  standalone: true,
  template: ''
})
class CompanyMembersStubComponent {}


describe('CompanySettingsPageComponent', () => {

  let component: CompanySettingsPageComponent;

  let fixture:
    ComponentFixture<CompanySettingsPageComponent>;

  let membershipService:
    jasmine.SpyObj<CompanyMembershipService>;

  let sectorService:
    jasmine.SpyObj<CompanySectorService>;

  let sizeService:
    jasmine.SpyObj<CompanySizeService>;

  let dialog: jasmine.SpyObj<MatDialog>;

  let selectedCompanyId:
    ReturnType<typeof signal<number | null>>;

  let memberships:
    ReturnType<typeof signal<UserCompanyMembership[]>>;

  let dialogClosed$: Subject<boolean>;


  const companyA: CompanyDetailResponse = {

    id: 3,
    name: 'Empresa A',
    sector_id: 1,
    size_id: 2,
    active: true,
    biannual_evaluation: true,
    next_evaluation: '2027-05-02'

  };

  const companyB: CompanyDetailResponse = {

    id: 7,
    name: 'Empresa B',
    sector_id: 2,
    size_id: 1,
    active: true,
    biannual_evaluation: false,
    next_evaluation: null

  };


  const membershipA: UserCompanyMembership = {

    membership_id: 10,
    company_id: 3,
    company_name: 'Empresa A',
    role: CompanyRole.COMPANY_ADMIN,
    joined_at: '2026-11-09T10:00:00'

  };

  const membershipB: UserCompanyMembership = {

    membership_id: 20,
    company_id: 7,
    company_name: 'Empresa B',
    role: CompanyRole.COLLABORATOR,
    joined_at: '2026-11-09T10:00:00'

  };


  const sectors: CompanySector[] = [

    { id: 1, name: 'Tecnología' },
    { id: 2, name: 'Servicios' }

  ];

  const sizes: CompanySize[] = [

    { id: 1, name: 'Pequeña' },
    { id: 2, name: 'Mediana' }

  ];


  beforeEach(async () => {

    selectedCompanyId =
      signal<number | null>(null);

    memberships = signal<UserCompanyMembership[]>([
      membershipA,
      membershipB
    ]);

    const selectedMembership = computed(() =>

      memberships().find(
        item =>
          item.company_id === selectedCompanyId()
      ) ?? null

    );

    const selectedRole = computed(
      () => selectedMembership()?.role ?? null
    );


    membershipService =
      jasmine.createSpyObj<CompanyMembershipService>(
        'CompanyMembershipService',
        ['getCompany']
      );

    membershipService.getCompany.and.callFake(
      companyId => of(
        companyId === 3 ? companyA : companyB
      )
    );


    sectorService =
      jasmine.createSpyObj<CompanySectorService>(
        'CompanySectorService',
        ['getAll']
      );

    sectorService.getAll.and.returnValue(of(sectors));


    sizeService =
      jasmine.createSpyObj<CompanySizeService>(
        'CompanySizeService',
        ['getAll']
      );

    sizeService.getAll.and.returnValue(of(sizes));


    dialogClosed$ = new Subject<boolean>();

    dialog = jasmine.createSpyObj<MatDialog>(
      'MatDialog',
      ['open']
    );

    dialog.open.and.returnValue({
      afterClosed: () => dialogClosed$.asObservable()
    } as ReturnType<MatDialog['open']>);


    await TestBed.configureTestingModule({

      imports: [
        CompanySettingsPageComponent
      ],

      providers: [

        {
          provide: CompanyContextService,
          useValue: {
            selectedCompanyId,
            selectedMembership,
            selectedRole,
            memberships,
            loading: signal(false),
            error: signal(false)
          }
        },

        {
          provide: CompanyMembershipService,
          useValue: membershipService
        },

        {
          provide: CompanySectorService,
          useValue: sectorService
        },

        {
          provide: CompanySizeService,
          useValue: sizeService
        },

        {
          provide: MatDialog,
          useValue: dialog
        }

      ]

    })
      .overrideComponent(
        CompanySettingsPageComponent,
        {
          remove: {
            imports: [CompanyMembersComponent]
          },
          add: {
            imports: [CompanyMembersStubComponent]
          }
        }
      )
      .compileComponents();


    fixture = TestBed.createComponent(
      CompanySettingsPageComponent
    );

    component = fixture.componentInstance;

    fixture.detectChanges();

    TestBed.flushEffects();

    fixture.detectChanges();

  });


  function selectCompany(
    companyId: number | null
  ): void {

    selectedCompanyId.set(companyId);

    fixture.detectChanges();

    TestBed.flushEffects();

    fixture.detectChanges();

  }


  // Creación y contexto inicial.

  it('should create', () => {

    expect(component).toBeTruthy();

  });


  it('should not load company details without a selected company', () => {

    expect(
      membershipService.getCompany
    ).not.toHaveBeenCalled();

    expect(component.company()).toBeNull();

    expect(component.loading()).toBeFalse();

  });


  it('should load the selected company details', () => {

    selectCompany(3);

    expect(
      membershipService.getCompany
    ).toHaveBeenCalledOnceWith(3);

    expect(component.company()).toEqual(companyA);

    expect(component.state().status).toBe('ready');

    expect(fixture.nativeElement.textContent)
      .toContain('Empresa A');

  });


  // Catálogos.

  it('should resolve sector and size names', () => {

    expect(component.sectorName(1))
      .toBe('Tecnología');

    expect(component.sizeName(2))
      .toBe('Mediana');

  });


  it('should return a fallback for unspecified catalog values', () => {

    expect(component.sectorName(null))
      .toBe('Sin especificar');

    expect(component.sizeName(null))
      .toBe('Sin especificar');

    expect(component.sectorName(999))
      .toBe('Sin especificar');

    expect(component.sizeName(999))
      .toBe('Sin especificar');

  });


  // Estados de interfaz.

  it('should show the skeleton while loading company details', () => {

    const pendingRequest =
      new Subject<CompanyDetailResponse>();

    membershipService.getCompany.and.returnValue(
      pendingRequest.asObservable()
    );

    selectCompany(3);

    expect(component.loading()).toBeTrue();

    expect(
      fixture.nativeElement.querySelector(
        '.company-skeleton'
      )
    ).not.toBeNull();

    pendingRequest.next(companyA);

    fixture.detectChanges();

    expect(component.loading()).toBeFalse();

    expect(
      fixture.nativeElement.querySelector(
        '.company-skeleton'
      )
    ).toBeNull();

  });


  it('should show an error when company details cannot be loaded', () => {

    membershipService.getCompany.and.returnValue(
      throwError(() => new Error('Request failed'))
    );

    selectCompany(3);

    expect(component.error()).toBeTrue();

    expect(component.company()).toBeNull();

    expect(fixture.nativeElement.textContent)
      .toContain('No pudimos cargar la información');

  });


  it('should retry a failed company request', () => {

    membershipService.getCompany.and.returnValues(

      throwError(() => new Error('Request failed')),

      of(companyA)

    );

    selectCompany(3);

    expect(component.error()).toBeTrue();

    component.retryLoad();

    fixture.detectChanges();

    expect(component.error()).toBeFalse();

    expect(component.company()).toEqual(companyA);

    expect(
      membershipService.getCompany
    ).toHaveBeenCalledTimes(2);

  });


  // Aislamiento empresarial.

  it('should reload company details when switching companies', () => {

    selectCompany(3);

    expect(component.company()).toEqual(companyA);

    selectCompany(7);

    expect(component.company()).toEqual(companyB);

    expect(
      membershipService.getCompany.calls.allArgs()
    ).toEqual([[3], [7]]);

  });


  it('should hide previous company details immediately', () => {

    selectCompany(3);

    expect(component.company()).toEqual(companyA);

    selectedCompanyId.set(7);

    // Sin ejecutar efectos todavía.
    expect(component.company()).toBeNull();

    expect(component.loading()).toBeTrue();

  });


  it('should ignore a pending response from the previous company', () => {

    const previousRequest =
      new Subject<CompanyDetailResponse>();

    membershipService.getCompany.and.returnValues(

      previousRequest.asObservable(),

      of(companyB)

    );

    selectCompany(3);

    expect(previousRequest.observed).toBeTrue();

    selectCompany(7);

    expect(previousRequest.observed).toBeFalse();

    previousRequest.next(companyA);

    expect(component.company()).toEqual(companyB);

  });


  // Permisos empresariales.

  it('should allow a company administrator to edit company details', () => {

    selectCompany(3);

    expect(component.canEdit()).toBeTrue();

    expect(
      fixture.nativeElement.querySelector(
        '.company-edit-button'
      )
    ).not.toBeNull();

    component.openEditCompany();

    expect(dialog.open).toHaveBeenCalledTimes(1);

  });


  it('should prevent editing by non-administrator roles', () => {

    const restrictedRoles = [

      CompanyRole.ASG_MANAGER,
      CompanyRole.COLLABORATOR,
      CompanyRole.AUDITOR

    ];

    for (const role of restrictedRoles) {

      memberships.set([
        {
          ...membershipA,
          role
        }
      ]);

      selectCompany(3);

      expect(component.canEdit()).toBeFalse();

      expect(
        fixture.nativeElement.querySelector(
          '.company-edit-button'
        )
      ).toBeNull();

      component.openEditCompany();

    }

    expect(dialog.open).not.toHaveBeenCalled();

  });


  it('should reload company details after a successful edit', () => {

    selectCompany(3);

    component.openEditCompany();

    dialogClosed$.next(true);

    expect(
      membershipService.getCompany.calls.allArgs()
    ).toEqual([[3], [3]]);

  });


  it('should not reload another company when the previous edit dialog closes', () => {

    selectCompany(3);

    component.openEditCompany();

    selectCompany(7);

    dialogClosed$.next(true);

    expect(
      membershipService.getCompany.calls.allArgs()
    ).toEqual([[3], [7]]);

    expect(component.company()).toEqual(companyB);

  });


  it('should integrate the company members component', () => {

    selectCompany(3);

    expect(
      fixture.nativeElement.querySelector(
        'app-company-members'
      )
    ).not.toBeNull();

    selectCompany(null);

    expect(
      fixture.nativeElement.querySelector(
        'app-company-members'
      )
    ).toBeNull();

  });

});
