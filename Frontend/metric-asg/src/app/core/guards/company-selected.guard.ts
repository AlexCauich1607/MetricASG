
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';

import { CompanyContextService } from '../../services/company-context.service';
import { CompanyMembershipService } from '../../services/company-membership.service';

export const companySelectedGuard: CanActivateFn = () => {
    const router = inject(Router);
    const companyContext = inject(CompanyContextService);
    const membershipService = inject(CompanyMembershipService);

    return membershipService.getMyMemberships().pipe(
        map(memberships => {
            const selectedCompanyId =
                companyContext.selectedCompanyId();

            // Sincronizar las membresías con el backend.
            companyContext.memberships.set(memberships);

            // No seleccionar automáticamente una empresa desde el guard.
            // La selección debe existir para entrar a estas rutas.
            const selectedMembership = memberships.find(
                membership =>
                    membership.company_id === selectedCompanyId
            );

            if (!selectedMembership) {
                companyContext.clearSelectedCompany();

                return router.createUrlTree(['/user/home']);
            }

            return true;
        }),
        catchError(() =>
            of(router.createUrlTree(['/user/home']))
        )
    );
};
