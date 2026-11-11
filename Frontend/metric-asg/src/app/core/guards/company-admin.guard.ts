
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
            const selectedId = companyContext.selectedCompanyId();

            // Sincronizar las membresías con la información del backend.
            companyContext.memberships.set(memberships);

            // Inicializar la empresa únicamente si no existe una selección.
            if (selectedId === null) {
                companyContext.selectedCompanyId.set(
                    memberships[0]?.company_id ?? null
                );
            }

            const companyId = companyContext.selectedCompanyId();

            // Verificar que la empresa seleccionada siga siendo válida.
            const membership = memberships.find(
                item => item.company_id === companyId
            );

            if (!membership) {
                return router.createUrlTree(['/user/home']);
            }

            // Autorizar únicamente al administrador de la empresa activa.
            if (membership.role === CompanyRole.COMPANY_ADMIN) {
                return true;
            }

            return router.createUrlTree(['/user/home']);
        }),
        catchError(() =>
            of(router.createUrlTree(['/user/home']))
        )
    );
};
