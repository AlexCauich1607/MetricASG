import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
    CompanyMember,
    CompanyCreateRequest,
    CompanyCreateResponse,
    CompanyDetailResponse,
    CompanyUpdateRequest,
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

    createCompany(
        data: CompanyCreateRequest
    ): Observable<CompanyCreateResponse> {
        return this.http.post<CompanyCreateResponse>(
            this.apiUrl,
            data
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


    getCompany(
        companyId: number
    ): Observable<CompanyDetailResponse> {
        return this.http.get<CompanyDetailResponse>(
            `${this.apiUrl}/${companyId}`
        );
    }

    updateCompany(
        companyId: number,
        data: CompanyUpdateRequest
    ): Observable<CompanyDetailResponse> {
        return this.http.patch<CompanyDetailResponse>(
            `${this.apiUrl}/${companyId}`,
            data
        );
    }

}
