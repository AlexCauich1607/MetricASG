import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  Injector,
  computed,
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
import {
  CompanyMember,
  CompanyRole,
  UserCompanyMembership
} from '../../../models/company_membership';
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

  private readonly membersState =
    signal<CompanyMember[]>([]);

  private readonly loadingState =
    signal(false);

  private readonly errorState =
    signal(false);

  private readonly loadedContextKey =
    signal<string | null>(null);


  private getContextKey(
    membership: UserCompanyMembership | null
  ): string | null {

    if (!membership) {
      return null;
    }

    return [
      membership.company_id,
      membership.membership_id,
      membership.role
    ].join(':');

  }


  private readonly currentContextKey = computed(() =>

    this.getContextKey(
      this.companyContext.selectedMembership()
    )

  );


  readonly hasCurrentContext = computed(() =>

    this.currentContextKey() !== null &&

    this.loadedContextKey() ===
    this.currentContextKey()

  );


  readonly members = computed(() =>

    this.hasCurrentContext()
      ? this.membersState()
      : []

  );


  readonly loading = computed(() =>

    this.currentContextKey() !== null &&

    (
      !this.hasCurrentContext() ||
      this.loadingState()
    )

  );


  readonly error = computed(() =>

    this.hasCurrentContext() &&
    this.errorState()

  );

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

    toObservable(
      this.companyContext.selectedMembership,
      {
        injector: this.injector
      }
    )
      .pipe(

        distinctUntilChanged(
          (previous, current) =>
            this.getContextKey(previous) ===
            this.getContextKey(current)
        ),

        switchMap(membership => {

          this.cancelRemoval$.next();

          this.cancelInvitation$.next();

          this.sendingInvitation.set(false);

          this.invitationEmail.set('');

          this.invitationRole.set(
            CompanyRole.COLLABORATOR
          );

          this.invitationSuccess.set(false);

          this.invitationErrorMessage.set(null);

          this.removingMemberId.set(null);

          this.removeError.set(false);

          this.removeErrorMessage.set(null);


          this.membersState.set([]);

          this.errorState.set(false);

          this.loadingState.set(
            membership !== null
          );

          this.loadedContextKey.set(
            this.getContextKey(membership)
          );


          if (!membership) {

            return of(null);

          }


          return this.retryRequests$.pipe(

            startWith(void 0),

            switchMap(() => {

              this.membersState.set([]);

              this.errorState.set(false);

              this.loadingState.set(true);

              return this.membershipService

                .getMembers(membership.company_id)

                .pipe(

                  catchError(() => {

                    if (this.hasCurrentContext()) {

                      this.errorState.set(true);

                    }

                    return of(null);

                  })

                );

            })

          );

        }),

        takeUntilDestroyed(this.destroyRef)

      )
      .subscribe(members => {

        if (!this.hasCurrentContext()) {

          return;

        }

        if (members !== null) {

          this.membersState.set(members);

        }

        this.loadingState.set(false);

      });

  }


  retryLoadMembers(): void {

    if (!this.hasCurrentContext()) {

      return;

    }

    this.retryRequests$.next();

  }


  removeMember(member: CompanyMember): void {
    const membership = this.companyContext.selectedMembership();

    if (
      !membership ||
      !this.hasCurrentContext() ||
      membership.role !== CompanyRole.COMPANY_ADMIN ||
      this.removingMemberId() !== null ||
      !this.members().some(
        item => item.membership_id === member.membership_id
      )
    ) {
      return;
    }

    const companyId = membership.company_id;

    const operationContextKey =
      this.getContextKey(membership);

    const isCurrentOperation = (): boolean =>

      this.hasCurrentContext() &&

      this.currentContextKey() === operationContextKey;

    const confirmed = window.confirm(
      `¿Deseas eliminar a ${member.email} de esta empresa?`
    );

    if (!confirmed) {
      return;
    }

    // Evitar operaciones sobre una empresa diferente.
    if (
      !isCurrentOperation() ||
      this.companyContext.selectedCompanyId() !== companyId ||
      this.companyContext.selectedRole() !== CompanyRole.COMPANY_ADMIN ||
      !this.members().some(
        item => item.membership_id === member.membership_id
      )
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

          if (!isCurrentOperation()) {
            return;
          }

          this.membersState.update(current =>
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

          if (!isCurrentOperation()) {
            return;
          }

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
      !this.hasCurrentContext() ||
      membership.role !== CompanyRole.COMPANY_ADMIN ||
      this.sendingInvitation() ||
      !validEmail ||
      !this.companyRoles.includes(role)
    ) {
      return;
    }

    const companyId = membership.company_id;

    const operationContextKey =
      this.getContextKey(membership);

    const isCurrentOperation = (): boolean =>

      this.hasCurrentContext() &&

      this.currentContextKey() === operationContextKey;

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

          if (!isCurrentOperation()) {
            return;
          }

          this.invitationSuccess.set(true);
          this.invitationEmail.set('');
          this.invitationRole.set(CompanyRole.COLLABORATOR);
        },
        error: (err: HttpErrorResponse) => {

          if (!isCurrentOperation()) {
            return;
          }
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
