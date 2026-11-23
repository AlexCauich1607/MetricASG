
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { CompanyContextService } from '../../services/company-context.service';
import { CompanyMembershipService } from '../../services/company-membership.service';
import { CompanyRole } from '../../models/company_membership';

export const companyAdminGuard: CanActivateFn = () => {
  const router = inject(Router);
  const companyContext = inject(CompanyContextService);
  const membershipService = inject(CompanyMembershipService);

  return membershipService.getMyMemberships().pipe(
    map(memberships => {
      const selectedCompanyId =
        companyContext.selectedCompanyId();

      companyContext.memberships.set(memberships);

      const membership = memberships.find(
        item => item.company_id === selectedCompanyId
      );

      if (!membership) {
        companyContext.clearSelectedCompany();

        return router.createUrlTree(['/user/home']);
      }

      if (membership.role !== CompanyRole.COMPANY_ADMIN) {
        return router.createUrlTree(['/user/home']);
      }

      return true;
    }),
    catchError(() =>
      of(router.createUrlTree(['/user/home']))
    )
  );
};
