
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CompanyContextService } from './company-context.service';
import { CompanyMembershipService } from './company-membership.service';
import {
  CompanyRole,
  UserCompanyMembership
} from '../models/company_membership';

describe('CompanyContextService', () => {
  let service: CompanyContextService;
  let membershipService: jasmine.SpyObj<CompanyMembershipService>;

  const memberships: UserCompanyMembership[] = [
    {
      membership_id: 10,
      company_id: 3,
      company_name: 'Empresa A',
      role: CompanyRole.COMPANY_ADMIN,
      joined_at: '2026-11-09T10:00:00'
    },
    {
      membership_id: 18,
      company_id: 7,
      company_name: 'Empresa B',
      role: CompanyRole.COLLABORATOR,
      joined_at: '2026-11-09T10:30:00'
    }
  ];

  beforeEach(() => {
    membershipService = jasmine.createSpyObj<CompanyMembershipService>(
      'CompanyMembershipService',
      ['getMyMemberships']
    );

    TestBed.configureTestingModule({
      providers: [
        CompanyContextService,
        {
          provide: CompanyMembershipService,
          useValue: membershipService
        }
      ]
    });

    service = TestBed.inject(CompanyContextService);
  });

  it('should load memberships and select the first company', () => {
    membershipService.getMyMemberships.and.returnValue(of(memberships));

    service.loadMemberships();

    expect(service.memberships()).toEqual(memberships);
    expect(service.selectedCompanyId()).toBe(3);
    expect(service.selectedRole()).toBe(CompanyRole.COMPANY_ADMIN);
    expect(service.loading()).toBeFalse();
    expect(service.error()).toBeFalse();
  });

  it('should allow switching to another available company', () => {
    membershipService.getMyMemberships.and.returnValue(of(memberships));

    service.loadMemberships();
    service.selectCompany(7);

    expect(service.selectedCompanyId()).toBe(7);
    expect(service.selectedMembership()?.company_name).toBe('Empresa B');
    expect(service.selectedRole()).toBe(CompanyRole.COLLABORATOR);
  });

  it('should reject selecting a company outside the memberships', () => {
    membershipService.getMyMemberships.and.returnValue(of(memberships));

    service.loadMemberships();
    service.selectCompany(999);

    expect(service.selectedCompanyId()).toBe(3);
    expect(service.selectedRole()).toBe(CompanyRole.COMPANY_ADMIN);
  });

  it('should clear the selected company and memberships', () => {
    membershipService.getMyMemberships.and.returnValue(of(memberships));

    service.loadMemberships();
    service.clear();

    expect(service.memberships()).toEqual([]);
    expect(service.selectedCompanyId()).toBeNull();
    expect(service.selectedMembership()).toBeNull();
    expect(service.selectedRole()).toBeNull();
  });
});
