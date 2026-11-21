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
    CompanyCreateRequest,
    CompanyCreateResponse,
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
    it('should create a company with sector and size', () => {
        const payload: CompanyCreateRequest = {
            name: 'Empresa ASG',
            sector_id: 2,
            size_id: 3
        };

        const createdCompany: CompanyCreateResponse = {
            id: 15,
            name: 'Empresa ASG',
            sector_id: 2,
            size_id: 3,
            active: true
        };

        service.createCompany(payload).subscribe(response => {
            expect(response).toEqual(createdCompany);
        });

        const request = httpMock.expectOne(
            'http://localhost:8000/api/companies'
        );

        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual(payload);

        request.flush(createdCompany, {
            status: 201,
            statusText: 'Created'
        });
    });

    it('should create a company using only its name', () => {
        const payload: CompanyCreateRequest = {
            name: 'Empresa Personal'
        };

        const createdCompany: CompanyCreateResponse = {
            id: 16,
            name: 'Empresa Personal',
            sector_id: null,
            size_id: null,
            active: true
        };

        service.createCompany(payload).subscribe(response => {
            expect(response).toEqual(createdCompany);
        });

        const request = httpMock.expectOne(
            'http://localhost:8000/api/companies'
        );

        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({
            name: 'Empresa Personal'
        });

        expect(request.request.body.sector_id).toBeUndefined();
        expect(request.request.body.size_id).toBeUndefined();

        request.flush(createdCompany, {
            status: 201,
            statusText: 'Created'
        });
    });

    it('should propagate company creation errors', () => {
        const payload: CompanyCreateRequest = {
            name: 'Empresa Inválida',
            sector_id: 999999
        };

        let errorStatus: number | undefined;

        service.createCompany(payload).subscribe({
            next: () => fail('Expected company creation to fail'),
            error: error => {
                errorStatus = error.status;
            }
        });

        const request = httpMock.expectOne(
            'http://localhost:8000/api/companies'
        );

        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual(payload);

        request.flush(
            { detail: 'Invalid sector' },
            {
                status: 422,
                statusText: 'Unprocessable Entity'
            }
        );

        expect(errorStatus).toBe(422);
    });
});
