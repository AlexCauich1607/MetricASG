
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import {
    CompanyMember,
    UserCompanyMembership
} from '../models/company_membership';

@Injectable({
    providedIn: 'root'
})
export class CompanyMembershipService {
    private readonly apiUrl = 'http://localhost:8000/api/companies';

    constructor(private http: HttpClient) { }

    getMyMemberships(): Observable<UserCompanyMembership[]> {
        return this.http.get<UserCompanyMembership[]>(
            `${this.apiUrl}/me/memberships`
        );
    }


    getMembers(companyId: number): Observable<CompanyMember[]> {
        return this.http.get<CompanyMember[]>(
            `${this.apiUrl}/${companyId}/members`
        );
    }

    removeMember(
        companyId: number,
        membershipId: number
    ): Observable<void> {
        return this.http.delete<void>(
            `${this.apiUrl}/${companyId}/members/${membershipId}`
        );
    }
}
