
import { TestBed } from '@angular/core/testing';
import {
    HttpTestingController,
    provideHttpClientTesting
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { CompanyMembershipService } from './company-membership.service';
import {
    CompanyMember,
    CompanyMembershipStatus,
    CompanyRole,
    UserCompanyMembership
} from '../models/company_membership';

describe('CompanyMembershipService', () => {
    let service: CompanyMembershipService;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                CompanyMembershipService,
                provideHttpClient(),
                provideHttpClientTesting()
            ]
        });

        service = TestBed.inject(CompanyMembershipService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should retrieve company members', () => {
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

        service.getMembers(3).subscribe(response => {
            expect(response).toEqual(members);
        });

        const request = httpMock.expectOne(
            'http://localhost:8000/api/companies/3/members'
        );

        expect(request.request.method).toBe('GET');

        request.flush(members);
    });

    it('should remove a company member', () => {
        service.removeMember(3, 10).subscribe(response => {
            expect(response).toBeNull();
        });

        const request = httpMock.expectOne(
            'http://localhost:8000/api/companies/3/members/10'
        );

        expect(request.request.method).toBe('DELETE');

        request.flush(null, {
            status: 204,
            statusText: 'No Content'
        });
    });

    it('should retrieve memberships of the authenticated user', () => {
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

        service.getMyMemberships().subscribe(response => {
            expect(response).toEqual(memberships);
        });

        const request = httpMock.expectOne(
            'http://localhost:8000/api/companies/me/memberships'
        );

        expect(request.request.method).toBe('GET');

        request.flush(memberships);
    });

});
