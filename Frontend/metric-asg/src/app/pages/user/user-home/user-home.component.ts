import { Component, ComponentRef, ViewContainerRef, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { ResultEvaluation } from '../../../models/evaluation_result';
import { EvaluationService } from '../../../services/evaluation.service';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
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
  CompanyDetailResponse
} from '../../../models/company_membership';

import { CreateCompanyComponent } from '../../modals/create-company/create-company.component';
import { CompanyInvitationService } from '../../../services/company-invitation.service';

Chart.register(...registerables);


@Component({
  selector: 'app-user-home',
  standalone: true,
  imports: [
    AmbitCardComponent,
    BarChartComponent,
    UiStateComponent
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

  get canStartEvaluation(): boolean {
    const company = this.company;

    if (
      this.companyLoading ||
      this.companyError ||
      !company ||
      !company.active
    ) {
      return false;
    }

    if (!company.biannual_evaluation) {
      return true;
    }

    if (!company.next_evaluation) {
      return false;
    }

    // Comparación por fecha calendario, sin depender de la hora.
    const today = new Date();
    const todayDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('-');

    return company.next_evaluation.slice(0, 10) <= todayDate;
  }

  loadingChart = false;
  resultsStatus: 'loading' | 'error' | 'empty' | 'success' = 'loading';

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

    toObservable(this.companyContext.selectedCompanyId)
      .pipe(
        tap(() => {
          this.clearResultsState();
          this.resultsStatus = 'loading';
        }),
        switchMap(companyId => {
          if (companyId === null) {
            this.resultsStatus = 'empty';
            return EMPTY;
          }

          return this.resultService.getLastEvaluationResult().pipe(

            catchError(error => {
              const noEvaluations =
                error?.status === 404 &&
                error?.error?.detail === 'No evaluations found';

              if (noEvaluations) {
                this.resultsStatus = 'empty';
              } else {
                console.error('Error al cargar resultados:', error);
                this.resultsStatus = 'error';
              }

              return EMPTY;
            })

          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(data => {
        this.results = data;

        if (!data) {
          this.resultsStatus = 'empty';
          return;
        }

        this.resultsStatus = 'success';
        this.getPeriodo(data.date);
        this.cargarGrafica();
      });
    toObservable(this.companyContext.selectedCompanyId)
      .pipe(
        tap(() => {
          this.company = null;
          this.companyLoading = true;
          this.companyError = false;
          this.evaluationDate = '';
        }),
        switchMap(companyId => {
          if (companyId === null) {
            this.companyLoading = false;
            return EMPTY;
          }

          return this.companyMembershipService.getCompany(companyId).pipe(
            catchError(error => {
              console.error('Error al consultar empresa:', error);
              this.companyError = true;
              this.companyLoading = false;
              return EMPTY;
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(company => {
        this.company = company;
        this.companyLoading = false;

        this.evaluationDate = company.next_evaluation
          ? this.formatDateDDMMYYString(company.next_evaluation)
          : '';
      });
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

  chart: any;
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

  cargarGrafica(): void {
    this.loadingChart = false;
    this.results?.ambits.forEach(a => {
      this.ambits.push(a.ambit_name)
      this.scores.push(parseFloat(a.score.toFixed(1)));
      this.colors.push(a.color);
      this.bordes.push(a.maturity_color);
    });
    this.loadingChart = true;

  }


  onSelect(event: any): void {
    console.log('Barra seleccionada:', event);

  }



  yAxisTickFormatting(value: number): string {
    return `${value}/10`;
  }

  loadResults() {
    this.resultService.getLastEvaluationResult().subscribe({
      next: (data) => {
        this.results = data;
        this.getPeriodo(this.results.date);
        this.cargarGrafica();

      },
      error: (err) => {

      }
    })
  }

  getBorderColor(level: string): string {
    let color = "";
    if (level === "Básico") {
      color = "#ce4040ff";
    } else if (level === "Intermedio") {
      color = "#eac84fff";
    } else {
      color = "#15b91dff";
    }
    return color;
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

  formatDateDDMMYY(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString();

    return `${day}/${month}/${year}`;
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

  downloadPdf() {
    this.router.navigate(['/user/results']);
  }
}
