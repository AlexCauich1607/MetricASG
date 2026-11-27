import {
  Component,
  ViewContainerRef,
  ChangeDetectionStrategy,
  DestroyRef,
  computed,
  signal
} from '@angular/core';
import { ResultEvaluation } from '../../../models/evaluation_result';
import { EvaluationService } from '../../../services/evaluation.service';
import { UserService } from '../../../services/user.service';
import { User } from '../../../models/user';
import { Router } from '@angular/router';
import { SessionService } from '../../../shared/class/temporalStorage';
import { MatDialog } from '@angular/material/dialog';
import { AmbitCardComponent } from '../../../shared/ambit-card/ambit-card.component';
import { BarChartComponent } from '../../../shared/bar-chart/bar-chart.component';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  switchMap,
  tap,
  catchError,
  finalize
} from 'rxjs';
import { CompanyContextService } from '../../../services/company-context.service';
import { UiStateComponent } from '../../../shared/ui-state/ui-state.component';
import { CompanyMembershipService } from '../../../services/company-membership.service';
import {
  CompanyCreateResponse,
  CompanyDetailResponse,
  CompanyRole
} from '../../../models/company_membership';

import { CreateCompanyComponent } from '../../modals/create-company/create-company.component';
import { CompanyInvitationService } from '../../../services/company-invitation.service';
import { DashboardSkeletonComponent } from
  './dashboard-skeleton/dashboard-skeleton.component';

type DashboardStatus =
  | 'context-loading'
  | 'context-error'
  | 'no-companies'
  | 'no-selection'
  | 'loading'
  | 'error'
  | 'empty'
  | 'success';

@Component({
  selector: 'app-user-home',
  standalone: true,
  imports: [
    AmbitCardComponent,
    BarChartComponent,
    UiStateComponent,
    DashboardSkeletonComponent
  ],
  templateUrl: './user-home.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './user-home.component.scss'
})
export class UserHomeComponent {
  id_user: number = SessionService.getSessionItem('id') ?? 0;
  mesActual = '';
  anioActual = '';
  mesAnterior = '';
  anioAnterior = '';
  evaluationDate = '';

  results: ResultEvaluation | null = null;

  ambits: string[] = [];
  scores: number[] = [];
  colors: string[] = [];
  bordes: string[] = [];

  user: User | null = null;

  company: CompanyDetailResponse | null = null;
  companyLoading = true;
  companyError = false;

  invitationToken = '';
  acceptingInvitation = false;
  invitationError = '';
  invitationSuccess = false;
  invitationAcceptedPendingSync = false;


  get hasEvaluationPermission(): boolean {
    const role =
      this.companyContext.selectedMembership()?.role;

    return (
      role === CompanyRole.COMPANY_ADMIN ||
      role === CompanyRole.ASG_MANAGER ||
      role === CompanyRole.COLLABORATOR
    );
  }

  get evaluationUnavailableReason(): string | null {
    const company = this.company;
    const selectedCompanyId =
      this.companyContext.selectedCompanyId();

    if (
      this.companyContext.loading() ||
      this.isCompanyLoading
    ) {
      return 'Estamos consultando la disponibilidad.';
    }

    if (
      this.companyContext.error() ||
      this.hasCompanyError
    ) {
      return 'No fue posible verificar la disponibilidad.';
    }

    if (
      selectedCompanyId === null ||
      !company ||
      company.id !== selectedCompanyId
    ) {
      return 'Selecciona una empresa disponible.';
    }

    if (!company.active) {
      return 'Esta empresa no se encuentra activa.';
    }

    if (!this.hasEvaluationPermission) {
      return 'Tu rol no permite iniciar un autodiagnóstico.';
    }

    if (!company.biannual_evaluation) {
      return null;
    }

    if (!company.next_evaluation) {
      return 'No existe una fecha de evaluación programada.';
    }

    const today = new Date();

    const todayDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('-');

    if (company.next_evaluation.slice(0, 10) > todayDate) {
      return 'El siguiente periodo de evaluación aún no está disponible.';
    }

    return null;
  }

  get canStartEvaluation(): boolean {
    return this.evaluationUnavailableReason === null;
  }

  get evaluationActionLabel(): string {
    const role =
      this.companyContext.selectedMembership()?.role;

    if (role === CompanyRole.AUDITOR) {
      return 'Acceso de solo lectura';
    }

    if (!this.canStartEvaluation) {
      return 'Autodiagnóstico no disponible';
    }

    if (role === CompanyRole.COLLABORATOR) {
      return 'Trabajar en borrador';
    }

    return 'Realizar autodiagnóstico';
  }

  loadingChart = false;
  resultsStatus: 'loading' | 'error' | 'empty' | 'success' = 'loading';

  private readonly resultsRetryVersion = signal(0);

  private readonly companyRetryVersion = signal(0);

  private resultsCompanyId: number | null = null;

  private requestedCompanyId: number | null = null;

  private readonly activeCompanyId = computed(() => {
    if (
      this.companyContext.loading() ||
      this.companyContext.error()
    ) {
      return null;
    }

    return this.companyContext.selectedMembership()?.company_id
      ?? null;
  });

  private readonly resultsRequest = computed(() => ({
    companyId: this.activeCompanyId(),
    version: this.resultsRetryVersion()
  }));

  private readonly companyRequest = computed(() => ({
    companyId: this.activeCompanyId(),
    version: this.companyRetryVersion()
  }));

  get dashboardStatus(): DashboardStatus {
    if (this.companyContext.loading()) {
      return 'context-loading';
    }

    if (this.companyContext.error()) {
      return 'context-error';
    }

    if (this.companyContext.memberships().length === 0) {
      return 'no-companies';
    }

    const companyId = this.activeCompanyId();

    if (companyId === null) {
      return 'no-selection';
    }

    if (this.resultsCompanyId !== companyId) {
      return 'loading';
    }

    return this.resultsStatus;
  }

  get hasCurrentResults(): boolean {
    return (
      this.dashboardStatus === 'success' &&
      this.results !== null
    );
  }

  get isCompanyLoading(): boolean {
    const companyId = this.activeCompanyId();

    return (
      companyId !== null &&
      (
        this.requestedCompanyId !== companyId ||
        this.companyLoading
      )
    );
  }

  get hasCompanyError(): boolean {
    const companyId = this.activeCompanyId();

    return (
      companyId !== null &&
      this.requestedCompanyId === companyId &&
      this.companyError
    );
  }

  constructor(
    private resultService: EvaluationService,
    private userService: UserService,
    private router: Router,
    private dialog: MatDialog,
    private vcr: ViewContainerRef,
    public companyContext: CompanyContextService,
    private destroyRef: DestroyRef,
    private companyMembershipService: CompanyMembershipService,
    private companyInvitationService: CompanyInvitationService,
  ) {

    toObservable(this.resultsRequest)
      .pipe(
        tap(({ companyId }) => {
          this.clearResultsState();
          this.resultsCompanyId = companyId;

          this.resultsStatus = companyId === null
            ? 'empty'
            : 'loading';
        }),

        switchMap(({ companyId }) => {
          if (
            companyId === null ||
            companyId !== this.activeCompanyId()
          ) {
            return EMPTY;
          }

          return this.resultService
            .getLastEvaluationResult()
            .pipe(
              tap(data => {
                if (
                  companyId !== this.activeCompanyId()
                ) {
                  return;
                }

                this.results = data;

                if (!data) {
                  this.resultsStatus = 'empty';
                  return;
                }

                this.resultsStatus = 'success';

                this.getPeriodo(data.date);
                this.cargarGrafica();
              }),

              catchError(error => {
                if (
                  companyId !== this.activeCompanyId()
                ) {
                  return EMPTY;
                }

                const noEvaluations =
                  error?.status === 404 &&
                  error?.error?.detail ===
                  'No evaluations found';

                if (noEvaluations) {
                  this.resultsStatus = 'empty';
                } else {
                  console.error(
                    'Error al cargar resultados:',
                    error
                  );

                  this.resultsStatus = 'error';
                }

                return EMPTY;
              })
            );
        }),

        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
    toObservable(this.companyRequest)
      .pipe(
        tap(({ companyId }) => {
          this.requestedCompanyId = companyId;
          this.company = null;
          this.companyLoading = companyId !== null;
          this.companyError = false;
          this.evaluationDate = '';
        }),

        switchMap(({ companyId }) => {
          if (
            companyId === null ||
            companyId !== this.activeCompanyId()
          ) {
            return EMPTY;
          }

          return this.companyMembershipService
            .getCompany(companyId)
            .pipe(
              tap(company => {
                if (
                  companyId !== this.activeCompanyId()
                ) {
                  return;
                }

                if (company.id !== companyId) {
                  this.company = null;
                  this.companyError = true;
                  this.companyLoading = false;
                  return;
                }

                this.company = company;
                this.companyLoading = false;

                this.evaluationDate =
                  company.next_evaluation
                    ? this.formatDateDDMMYYString(
                      company.next_evaluation
                    )
                    : '';
              }),

              catchError(error => {
                if (
                  companyId !== this.activeCompanyId()
                ) {
                  return EMPTY;
                }

                console.error(
                  'Error al consultar empresa:',
                  error
                );

                this.companyError = true;
                this.companyLoading = false;

                return EMPTY;
              })
            );
        }),

        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  retryResults(): void {
    if (
      this.activeCompanyId() === null ||
      this.dashboardStatus !== 'error'
    ) {
      return;
    }

    this.clearResultsState();
    this.resultsStatus = 'loading';

    this.resultsRetryVersion.update(
      version => version + 1
    );
  }

  retryMemberships(): void {
    if (this.companyContext.loading()) {
      return;
    }

    if (this.invitationAcceptedPendingSync) {
      this.syncAcceptedInvitation();
      return;
    }

    this.companyContext.refreshMemberships()
      .pipe(
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }
  retryCompanyDetails(): void {
    if (
      this.activeCompanyId() === null ||
      !this.hasCompanyError
    ) {
      return;
    }

    this.company = null;
    this.companyLoading = true;
    this.companyError = false;
    this.evaluationDate = '';

    this.companyRetryVersion.update(
      version => version + 1
    );
  }
  private clearResultsState(): void {
    this.results = null;

    this.mesActual = '';
    this.anioActual = '';
    this.mesAnterior = '';
    this.anioAnterior = '';

    this.ambits = [];
    this.scores = [];
    this.colors = [];
    this.bordes = [];

    this.loadingChart = false;
  }

  ngOnInit(): void {
    this.loadUser();
  }


  loadUser(): void {
    this.userService.getMe().subscribe({
      next: value => {
        this.user = value;
      },
      error: err => {
        console.error('Error al cargar el perfil:', err);
      }
    });
  }

  private cargarGrafica(): void {
    const ambits = this.results?.ambits ?? [];

    this.loadingChart = false;

    this.ambits = ambits.map(
      ambit => ambit.ambit_name
    );

    this.scores = ambits.map(
      ambit => Number(ambit.score.toFixed(1))
    );

    this.colors = ambits.map(
      ambit => ambit.color
    );

    this.bordes = ambits.map(
      ambit => ambit.maturity_color
    );

    this.loadingChart = ambits.length > 0;
  }

  capitalizar(texto: string): string {
    if (!texto) return texto;
    return texto.charAt(0).toUpperCase() + texto.slice(1);
  }
  getPeriodo(fecha: string) {
    const hoy = new Date(fecha);
    this.mesActual = hoy.toLocaleString('es-ES', { month: 'long' });
    this.mesActual = this.capitalizar(this.mesActual);
    this.anioActual = hoy.toLocaleString('es-ES', { year: 'numeric' });
    const before = new Date(hoy);
    before.setMonth(hoy.getMonth() - 5);
    this.mesAnterior = before.toLocaleString('es-ES', { month: 'long' })
    this.mesAnterior = this.capitalizar(this.mesAnterior);
    this.anioAnterior = before.toLocaleString('es-ES', { year: 'numeric' });
  }

  formatDateDDMMYYString(fecha: string): string {
    const date = new Date(fecha);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString();

    return `${day}/${month}/${year}`;
  }

  goEvaluation(): void {
    if (
      this.companyContext.selectedCompanyId() !== null &&
      this.canStartEvaluation
    ) {
      this.router.navigate(['/user/evaluation']);
    }
  }

  openCreateCompany(): void {
    if (
      this.companyContext.loading() ||
      this.companyContext.error() ||
      this.companyContext.memberships().length > 0 ||
      this.companyContext.selectedCompanyId() !== null ||
      this.router.url.split('?')[0].split('#')[0] === '/user/evaluation'
    ) {
      return;
    }

    const dialogRef = this.dialog.open(CreateCompanyComponent, {
      width: '520px',
      maxWidth: '95vw',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(
      (company: CompanyCreateResponse | null | undefined) => {
        if (company) {
          this.companyContext.loadMemberships(company.id);
        }
      }
    );
  }

  acceptInvitation(): void {
    const token = this.invitationToken.trim();

    if (
      !token ||
      this.acceptingInvitation ||
      this.invitationAcceptedPendingSync ||
      this.companyContext.loading() ||
      this.companyContext.error() ||
      this.companyContext.memberships().length > 0 ||
      this.companyContext.selectedCompanyId() !== null
    ) {
      return;
    }

    this.acceptingInvitation = true;
    this.invitationError = '';
    this.invitationSuccess = false;

    this.companyInvitationService.acceptInvitation({ token })
      .pipe(
        finalize(() => {
          this.acceptingInvitation = false;
        })
      )
      .subscribe({
        next: () => {
          this.invitationToken = '';
          this.invitationAcceptedPendingSync = true;
          this.syncAcceptedInvitation();
        },
        error: () => {
          this.invitationError =
            'No fue posible aceptar la invitación. Verifica el token e inténtalo nuevamente.';
        }
      });
  }

  syncAcceptedInvitation(): void {
    if (
      !this.invitationAcceptedPendingSync ||
      this.companyContext.loading()
    ) {
      return;
    }

    this.invitationError = '';

    this.companyContext.refreshMemberships()
      .subscribe({
        next: memberships => {
          if (
            this.companyContext.error() ||
            memberships.length === 0 ||
            this.companyContext.selectedCompanyId() === null
          ) {
            this.invitationError =
              'La invitación fue aceptada, pero no pudimos actualizar tus empresas. Intenta sincronizarlas nuevamente.';
            return;
          }

          this.invitationAcceptedPendingSync = false;
          this.invitationSuccess = true;
        }
      });
  }

  goToResults(): void {
    if (this.hasCurrentResults) {
      this.router.navigate(['/user/analysis/results']);
    }
  }
}
