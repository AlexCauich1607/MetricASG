
import { Injectable, computed, signal } from '@angular/core';
import { catchError, finalize, Observable, of, tap } from 'rxjs';

import { CompanyMembershipService } from './company-membership.service';
import {
  CompanyRole,
  UserCompanyMembership
} from '../models/company_membership';

@Injectable({
  providedIn: 'root'
})
export class CompanyContextService {
  private readonly selectedCompanyStorageKey =
    'metricasg-selected-company-id';

  private readStoredCompanyId(): number | null {
    const stored = sessionStorage.getItem(
      this.selectedCompanyStorageKey
    );

    if (stored === null) {
      return null;
    }

    const companyId = Number(stored);

    return Number.isSafeInteger(companyId) && companyId > 0
      ? companyId
      : null;
  }

  private persistSelectedCompanyId(
    companyId: number | null
  ): void {
    if (companyId === null) {
      sessionStorage.removeItem(
        this.selectedCompanyStorageKey
      );
      return;
    }

    sessionStorage.setItem(
      this.selectedCompanyStorageKey,
      String(companyId)
    );
  }
  readonly memberships = signal<UserCompanyMembership[]>([]);
  readonly selectedCompanyId = signal<number | null>(
    this.readStoredCompanyId()
  );
  readonly loading = signal(false);
  readonly error = signal(false);

  readonly selectedMembership = computed(() =>
    this.memberships().find(
      membership => membership.company_id === this.selectedCompanyId()
    ) ?? null
  );

  readonly selectedRole = computed<CompanyRole | null>(
    () => this.selectedMembership()?.role ?? null
  );

  constructor(
    private membershipService: CompanyMembershipService
  ) { }

  loadMemberships(preferredCompanyId?: number): void {
    this.refreshMemberships(preferredCompanyId).subscribe();
  }

  refreshMemberships(
    preferredCompanyId?: number
  ): Observable<UserCompanyMembership[]> {
    this.loading.set(true);
    this.error.set(false);

    return this.membershipService.getMyMemberships().pipe(
      tap(memberships => {
        this.memberships.set(memberships);

        const preferredMembership = memberships.find(
          membership => membership.company_id === preferredCompanyId
        );

        if (preferredMembership) {
          this.selectedCompanyId.set(preferredMembership.company_id);
          this.persistSelectedCompanyId(preferredMembership.company_id);
          return;
        }

        const selectedId = this.selectedCompanyId();

        if (
          selectedId === null ||
          !memberships.some(
            membership => membership.company_id === selectedId
          )
        ) {
          const nextCompanyId = memberships[0]?.company_id ?? null;

          this.selectedCompanyId.set(nextCompanyId);
          this.persistSelectedCompanyId(nextCompanyId);
        } else {
          this.persistSelectedCompanyId(selectedId);
        }
      }),
      catchError(() => {
        this.memberships.set([]);
        this.selectedCompanyId.set(null);
        this.error.set(true);
        this.persistSelectedCompanyId(null);

        return of([]);
      }),
      finalize(() => {
        this.loading.set(false);
      })
    );
  }

  selectCompany(companyId: number): void {
    const belongsToCompany = this.memberships().some(
      membership => membership.company_id === companyId
    );

    if (!belongsToCompany) {
      return;
    }

    this.selectedCompanyId.set(companyId);
    this.persistSelectedCompanyId(companyId);
  }

  clearSelectedCompany(): void {
    this.selectedCompanyId.set(null);
    this.persistSelectedCompanyId(null);
  }

  clear(): void {
    this.memberships.set([]);
    this.selectedCompanyId.set(null);
    this.loading.set(false);
    this.error.set(false);
    this.persistSelectedCompanyId(null);
  }
}
