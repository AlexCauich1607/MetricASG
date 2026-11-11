import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  Injector,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Subject,
  distinctUntilChanged,
  switchMap,
  catchError,
  of,
  startWith,
  takeUntil,
  finalize
} from 'rxjs';

import { CompanyContextService } from '../../../services/company-context.service';
import { CompanyMembershipService } from '../../../services/company-membership.service';
import { CompanyMember, CompanyRole } from '../../../models/company_membership';
import { CompanyInvitationService } from '../../../services/company-invitation.service';

@Component({
  selector: 'app-company-members',
  standalone: true,
  imports: [],
  templateUrl: './company-members.component.html',
  styleUrl: './company-members.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class CompanyMembersComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  readonly members = signal<CompanyMember[]>([]);
  readonly loading = signal(false);
  readonly error = signal(false);
  private readonly retryRequests$ = new Subject<void>();
  readonly removingMemberId = signal<number | null>(null);
  readonly removeError = signal(false);
  readonly removeErrorMessage = signal<string | null>(null);
  private readonly cancelRemoval$ = new Subject<void>();
  private readonly router = inject(Router);
  readonly invitationEmail = signal('');
  readonly invitationRole = signal<CompanyRole>(
    CompanyRole.COLLABORATOR
  );

  readonly sendingInvitation = signal(false);
  readonly invitationSuccess = signal(false);
  readonly invitationErrorMessage = signal<string | null>(null);

  readonly companyRoles = [
    CompanyRole.COMPANY_ADMIN,
    CompanyRole.ASG_MANAGER,
    CompanyRole.COLLABORATOR,
    CompanyRole.AUDITOR
  ];

  private readonly cancelInvitation$ = new Subject<void>();

  constructor(
    public companyContext: CompanyContextService,
    private membershipService: CompanyMembershipService,
    private invitationService: CompanyInvitationService
  ) { }

  ngOnInit(): void {
    toObservable(this.companyContext.selectedMembership, {
      injector: this.injector
    })
      .pipe(
        distinctUntilChanged(
          (previous, current) =>
            previous?.company_id === current?.company_id &&
            previous?.role === current?.role
        ),

        switchMap(membership => {
          this.cancelRemoval$.next();
          this.cancelInvitation$.next();
          this.sendingInvitation.set(false);
          this.invitationEmail.set('');
          this.invitationRole.set(CompanyRole.COLLABORATOR);
          this.invitationSuccess.set(false);
          this.invitationErrorMessage.set(null);
          this.removingMemberId.set(null);
          this.removeError.set(false);
          this.removeErrorMessage.set(null);
          this.members.set([]);
          this.error.set(false);

          if (
            !membership ||
            membership.role !== CompanyRole.COMPANY_ADMIN
          ) {
            this.loading.set(false);
            return of(null);
          }

          return this.retryRequests$.pipe(
            startWith(void 0),
            switchMap(() => {
              this.members.set([]);
              this.error.set(false);
              this.loading.set(true);

              return this.membershipService
                .getMembers(membership.company_id)
                .pipe(
                  catchError(() => {
                    this.error.set(true);
                    return of(null);
                  })
                );
            })
          );
        }),

        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(members => {
        if (members !== null) {
          this.members.set(members);
        }

        this.loading.set(false);
      });
  }

  retryLoadMembers(): void {
    if (
      this.companyContext.selectedMembership()?.role !==
      CompanyRole.COMPANY_ADMIN
    ) {
      return;
    }

    this.retryRequests$.next();
  }


  removeMember(member: CompanyMember): void {
    const membership = this.companyContext.selectedMembership();

    if (
      !membership ||
      membership.role !== CompanyRole.COMPANY_ADMIN ||
      this.removingMemberId() !== null ||
      !this.members().some(
        item => item.membership_id === member.membership_id
      )
    ) {
      return;
    }

    const companyId = membership.company_id;

    const confirmed = window.confirm(
      `¿Deseas eliminar a ${member.email} de esta empresa?`
    );

    if (!confirmed) {
      return;
    }

    // Evitar operaciones sobre una empresa diferente.
    if (
      this.companyContext.selectedCompanyId() !== companyId ||
      this.companyContext.selectedRole() !== CompanyRole.COMPANY_ADMIN
    ) {
      return;
    }

    this.removeError.set(false);
    this.removeErrorMessage.set(null);
    this.removingMemberId.set(member.membership_id);

    this.membershipService
      .removeMember(companyId, member.membership_id)
      .pipe(
        takeUntil(this.cancelRemoval$),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.removingMemberId.set(null);
        })
      )
      .subscribe({
        next: () => {
          this.members.update(current =>
            current.filter(
              item => item.membership_id !== member.membership_id
            )
          );

          if (member.membership_id === membership.membership_id) {
            const remainingMemberships =
              this.companyContext.memberships().filter(
                item => item.membership_id !== member.membership_id
              );

            this.companyContext.memberships.set(remainingMemberships);

            this.companyContext.selectedCompanyId.set(
              remainingMemberships[0]?.company_id ?? null
            );

            void this.router.navigate(['/user/home']);
          }
        },
        error: (err: HttpErrorResponse) => {
          this.removeError.set(true);

          if (
            err.status === 409 &&
            err.error?.detail ===
            'Cannot remove the last active company administrator'
          ) {
            this.removeErrorMessage.set(
              'No puedes eliminar al último administrador activo de la empresa.'
            );
          } else if (
            err.status === 409 &&
            err.error?.detail ===
            'Cannot remove the last active company member'
          ) {
            this.removeErrorMessage.set(
              'No puedes eliminar al último integrante activo de la empresa.'
            );
          } else {
            this.removeErrorMessage.set(
              'No fue posible eliminar al miembro. Inténtalo nuevamente.'
            );
          }
        }

      });
  }


  sendInvitation(): void {
    const membership = this.companyContext.selectedMembership();
    const email = this.invitationEmail().trim();
    const role = this.invitationRole();
    const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    if (
      !membership ||
      membership.role !== CompanyRole.COMPANY_ADMIN ||
      this.sendingInvitation() ||
      !validEmail ||
      !this.companyRoles.includes(role)
    ) {
      return;
    }

    const companyId = membership.company_id;

    this.invitationSuccess.set(false);
    this.invitationErrorMessage.set(null);
    this.sendingInvitation.set(true);

    this.invitationService
      .createInvitation({
        company_id: companyId,
        email,
        role
      })
      .pipe(
        takeUntil(this.cancelInvitation$),
        takeUntilDestroyed(this.destroyRef),
        finalize(() => {
          this.sendingInvitation.set(false);
        })
      )
      .subscribe({
        next: () => {
          this.invitationSuccess.set(true);
          this.invitationEmail.set('');
          this.invitationRole.set(CompanyRole.COLLABORATOR);
        },
        error: (err: HttpErrorResponse) => {
          if (err.status === 409) {
            this.invitationErrorMessage.set(
              'No se pudo crear la invitación porque existe un conflicto con el usuario o una invitación pendiente.'
            );
          } else if (err.status === 403) {
            this.invitationErrorMessage.set(
              'No tienes permisos para enviar invitaciones a esta empresa.'
            );
          } else if (err.status === 404) {
            this.invitationErrorMessage.set(
              'No se encontró la empresa o el usuario indicado.'
            );
          } else {
            this.invitationErrorMessage.set(
              'No fue posible enviar la invitación. Inténtalo nuevamente.'
            );
          }
        }
      });
  }

}
