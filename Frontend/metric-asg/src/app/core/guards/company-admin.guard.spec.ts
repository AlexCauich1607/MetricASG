
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of, firstValueFrom, Observable, throwError } from 'rxjs';

import { companyAdminGuard } from './company-admin.guard';
import { CompanyContextService } from '../../services/company-context.service';
import { CompanyMembershipService } from '../../services/company-membership.service';
import {
    CompanyRole,
    UserCompanyMembership
} from '../../models/company_membership';

describe('companyAdminGuard', () => {
    let context: CompanyContextService;
    let membershipService: jasmine.SpyObj<CompanyMembershipService>;
    let router: Router;

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

        membershipService.getMyMemberships.and.returnValue(of(memberships));

        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                CompanyContextService,
                {
                    provide: CompanyMembershipService,
                    useValue: membershipService
                }
            ]
        });

        context = TestBed.inject(CompanyContextService);
        router = TestBed.inject(Router);
    });

    async function executeGuard(): Promise<boolean | string> {
        const result = TestBed.runInInjectionContext(
            () => companyAdminGuard({} as any, {} as any)
        );

        const resolved = result instanceof Observable
            ? await firstValueFrom(result)
            : await Promise.resolve(result);

        return typeof resolved === 'boolean'
            ? resolved
            : router.serializeUrl(resolved as any);
    }

    it('should allow access for the selected company administrator', async () => {
        context.selectedCompanyId.set(3);

        expect(await executeGuard()).toBeTrue();
        expect(context.selectedRole()).toBe(CompanyRole.COMPANY_ADMIN);
    });

    it('should deny access for a collaborator', async () => {
        context.selectedCompanyId.set(7);

        expect(await executeGuard()).toBe('/user/home');
    });

    it('should initialize company context when no company is selected', async () => {
        expect(context.selectedCompanyId()).toBeNull();

        expect(await executeGuard()).toBeTrue();

        expect(context.selectedCompanyId()).toBe(3);
        expect(context.memberships()).toEqual(memberships);
    });

    it('should deny access when the selected membership was removed', async () => {
        context.selectedCompanyId.set(99);

        expect(await executeGuard()).toBe('/user/home');
        expect(context.selectedCompanyId()).toBe(99);
    });

    it('should synchronize company roles with backend memberships', async () => {
        context.selectedCompanyId.set(3);
        context.memberships.set(memberships);

        const updatedMemberships = memberships.map(membership =>
            membership.company_id === 3
                ? { ...membership, role: CompanyRole.AUDITOR }
                : membership
        );

        membershipService.getMyMemberships.and.returnValue(
            of(updatedMemberships)
        );

        expect(await executeGuard()).toBe('/user/home');

        expect(context.selectedRole()).toBe(CompanyRole.AUDITOR);
    });

    it('should deny access for every non-admin company role', async () => {
        const restrictedRoles = [
            CompanyRole.ASG_MANAGER,
            CompanyRole.COLLABORATOR,
            CompanyRole.AUDITOR
        ];

        context.selectedCompanyId.set(3);

        for (const role of restrictedRoles) {
            membershipService.getMyMemberships.and.returnValue(
                of([
                    {
                        ...memberships[0],
                        role
                    }
                ])
            );

            expect(await executeGuard()).toBe('/user/home');
            expect(context.selectedRole()).toBe(role);
        }
    });


    it('should deny access when membership retrieval fails', async () => {
        context.selectedCompanyId.set(3);

        membershipService.getMyMemberships.and.returnValue(
            throwError(() => new Error('Network error'))
        );

        expect(await executeGuard()).toBe('/user/home');

        expect(membershipService.getMyMemberships)
            .toHaveBeenCalledTimes(1);
    });


});
