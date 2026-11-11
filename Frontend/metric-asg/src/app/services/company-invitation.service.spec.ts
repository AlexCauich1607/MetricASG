import { CompanyRole } from '../models/company_membership';
import { TestBed } from '@angular/core/testing';
import {
    provideHttpClient,
    withInterceptorsFromDi
} from '@angular/common/http';
import {
    provideHttpClientTesting,
    HttpTestingController
} from '@angular/common/http/testing';

import { CompanyInvitationService } from './company-invitation.service';
import {
    CompanyInvitation,
    CompanyInvitationCreate
} from '../models/company_invitation';

describe('CompanyInvitationService', () => {
    let service: CompanyInvitationService;
    let httpMock: HttpTestingController;

    const apiUrl = 'http://localhost:8000/api/company-invitations';

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting(),
                CompanyInvitationService
            ]
        });

        service = TestBed.inject(CompanyInvitationService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
    });

    it('should create an invitation with the selected company role', () => {
        const payload: CompanyInvitationCreate = {
            company_id: 10,
            email: 'recipient@example.com',
            role: CompanyRole.ASG_MANAGER
        };

        const invitation: CompanyInvitation = {
            id: 1,
            company_id: 10,
            invited_by_user_id: 2,
            email: payload.email,
            role: payload.role,
            status: 'PENDING',
            created_at: '2026-11-11T10:00:00Z',
            expires_at: '2026-11-18T10:00:00Z',
            accepted_at: null,
            last_resent_at: null
        };

        service.createInvitation(payload).subscribe(response => {
            expect(response).toEqual(invitation);
        });

        const request = httpMock.expectOne(apiUrl);

        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual(payload);

        request.flush(invitation);
    });

    it('should accept an invitation using its token', () => {
        const payload = {
            token: 'secure-invitation-token'
        };

        service.acceptInvitation(payload).subscribe(response => {
            expect(response).toEqual({ id: 5 });
        });

        const request = httpMock.expectOne(`${apiUrl}/accept`);

        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual(payload);

        request.flush({ id: 5 });
    });

    it('should resend an existing invitation', () => {
        const invitationId = 1;

        service.resendInvitation(invitationId).subscribe();

        const request = httpMock.expectOne(
            `${apiUrl}/${invitationId}/resend`
        );

        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({});

        request.flush({});
    });
});
