
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { firstValueFrom, of, throwError } from 'rxjs';

import { companySelectedGuard } from './company-selected.guard';
import { CompanyContextService } from '../../services/company-context.service';
import { CompanyMembershipService } from '../../services/company-membership.service';

import {
    CompanyRole,
    UserCompanyMembership
} from '../../models/company_membership';

describe('companySelectedGuard', () => {
    let context: CompanyContextService;
    let membershipService: jasmine.SpyObj<CompanyMembershipService>;
    let router: Router;

    const membership: UserCompanyMembership = {
        membership_id: 10,
        company_id: 3,
        company_name: 'Empresa A',
        role: CompanyRole.COMPANY_ADMIN,
        joined_at: '2026-11-09T10:00:00'
    };

    beforeEach(() => {
        membershipService = jasmine.createSpyObj(
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

        context = TestBed.inject(CompanyContextService);
        router = TestBed.inject(Router);
    });

    async function executeGuard(): Promise<boolean | UrlTree> {
        const result = TestBed.runInInjectionContext(() =>
            companySelectedGuard({} as any, {} as any)
        );

        return firstValueFrom(result as any);
    }

    it('allows access with a valid selected company', async () => {
        context.selectedCompanyId.set(3);
        membershipService.getMyMemberships.and.returnValue(
            of([membership])
        );

        const result = await executeGuard();

        expect(result).toBeTrue();
        expect(context.memberships()).toEqual([membership]);
        expect(context.selectedCompanyId()).toBe(3);
    });

    it('redirects when no company is selected', async () => {
        membershipService.getMyMemberships.and.returnValue(
            of([membership])
        );

        const result = await executeGuard();

        expect(result instanceof UrlTree).toBeTrue();
        expect(router.serializeUrl(result as UrlTree))
            .toBe('/user/home');
        expect(context.selectedCompanyId()).toBeNull();
    });

    it('redirects when the selected membership is revoked', async () => {
        context.selectedCompanyId.set(3);
        context.memberships.set([membership]);

        membershipService.getMyMemberships.and.returnValue(
            of([])
        );

        const result = await executeGuard();

        expect(result instanceof UrlTree).toBeTrue();
        expect(router.serializeUrl(result as UrlTree))
            .toBe('/user/home');
        expect(context.memberships()).toEqual([]);
        expect(context.selectedCompanyId()).toBeNull();
    });

    it('redirects when memberships cannot be loaded', async () => {
        context.selectedCompanyId.set(3);

        membershipService.getMyMemberships.and.returnValue(
            throwError(() => new Error('Network error'))
        );

        const result = await executeGuard();

        expect(result instanceof UrlTree).toBeTrue();
        expect(router.serializeUrl(result as UrlTree))
            .toBe('/user/home');
    });

    it('preserves valid memberships when the selected company is revoked', async () => {
        const otherMembership: UserCompanyMembership = {
            membership_id: 18,
            company_id: 7,
            company_name: 'Empresa B',
            role: CompanyRole.COLLABORATOR,
            joined_at: '2026-11-09T10:30:00'
        };

        // La empresa 3 estaba seleccionada, pero ya no está autorizada.
        context.selectedCompanyId.set(3);

        membershipService.getMyMemberships.and.returnValue(
            of([otherMembership])
        );

        const result = await executeGuard();

        expect(result instanceof UrlTree).toBeTrue();

        expect(router.serializeUrl(result as UrlTree))
            .toBe('/user/home');

        // La selección inválida se elimina.
        expect(context.selectedCompanyId()).toBeNull();

        // La empresa B sigue disponible.
        expect(context.memberships()).toEqual([otherMembership]);

        expect(
            sessionStorage.getItem('metricasg-selected-company-id')
        ).toBeNull();
    });

});
