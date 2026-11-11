
import { Injectable, computed, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { CompanyMembershipService } from './company-membership.service';
import {
  CompanyRole,
  UserCompanyMembership
} from '../models/company_membership';

@Injectable({
  providedIn: 'root'
})
export class CompanyContextService {
  readonly memberships = signal<UserCompanyMembership[]>([]);
  readonly selectedCompanyId = signal<number | null>(null);
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
  ) {}

  loadMemberships(): void {
    this.loading.set(true);
    this.error.set(false);

    this.membershipService.getMyMemberships()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: memberships => {
          this.memberships.set(memberships);

          const selectedId = this.selectedCompanyId();

          if (
            selectedId === null ||
            !memberships.some(
              membership => membership.company_id === selectedId
            )
          ) {
            this.selectedCompanyId.set(
              memberships[0]?.company_id ?? null
            );
          }
        },
        error: () => {
          this.memberships.set([]);
          this.selectedCompanyId.set(null);
          this.error.set(true);
        }
      });
  }

  selectCompany(companyId: number): void {
    const belongsToCompany = this.memberships().some(
      membership => membership.company_id === companyId
    );

    if (belongsToCompany) {
      this.selectedCompanyId.set(companyId);
    }
  }

  clear(): void {
    this.memberships.set([]);
    this.selectedCompanyId.set(null);
    this.loading.set(false);
    this.error.set(false);
  }
}
