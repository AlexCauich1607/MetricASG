
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
    CompanyInvitation,
    CompanyInvitationCreate,
    CompanyInvitationAccept
} from '../models/company_invitation';

@Injectable({
    providedIn: 'root'
})
export class CompanyInvitationService {
    private readonly apiUrl = 'http://localhost:8000/api/company-invitations';

    constructor(private http: HttpClient) { }

    createInvitation(
        payload: CompanyInvitationCreate
    ): Observable<CompanyInvitation> {
        return this.http.post<CompanyInvitation>(
            this.apiUrl,
            payload
        );
    }

    acceptInvitation(
        payload: CompanyInvitationAccept
    ): Observable<unknown> {
        return this.http.post<unknown>(
            `${this.apiUrl}/accept`,
            payload
        );
    }

    resendInvitation(
        invitationId: number
    ): Observable<CompanyInvitation> {
        return this.http.post<CompanyInvitation>(
            `${this.apiUrl}/${invitationId}/resend`,
            {}
        );
    }
}
