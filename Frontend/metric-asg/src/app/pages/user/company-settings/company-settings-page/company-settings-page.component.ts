
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  Injector,
  inject,
  signal,
  computed,
  OnInit
} from '@angular/core';

import { MatDialog } from '@angular/material/dialog';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  Subject,
  switchMap,
  startWith,
  distinctUntilChanged,
  catchError,
  of
} from 'rxjs';

import { CompanyContextService } from '../../../../services/company-context.service';
import { CompanyMembershipService } from '../../../../services/company-membership.service';
import { CompanySectorService } from '../../../../services/company-sector.service';
import { CompanySizeService } from '../../../../services/company-size.service';

import {
  CompanyDetailResponse,
  CompanyRole
} from '../../../../models/company_membership';

import { CompanySector } from '../../../../models/company_sector';
import { CompanySize } from '../../../../models/company_size';

import { CompanyMembersComponent } from '../../company-members/company-members.component';
import { CompanySettingsComponent } from '../../../modals/settings/company-settings/company-settings.component';

@Component({
  selector: 'app-company-settings-page',
  standalone: true,
  imports: [CompanyMembersComponent],
  templateUrl: './company-settings-page.component.html',
  styleUrl: './company-settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.Eager
})
export class CompanySettingsPageComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  readonly company = signal<CompanyDetailResponse | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);

  readonly sectors = signal<CompanySector[]>([]);
  readonly sizes = signal<CompanySize[]>([]);

  readonly canEdit = computed(
    () =>
      this.companyContext.selectedRole() ===
      CompanyRole.COMPANY_ADMIN
  );

  private readonly retryRequests$ = new Subject<void>();

  constructor(
    public readonly companyContext: CompanyContextService,
    private readonly membershipService: CompanyMembershipService,
    private readonly sectorService: CompanySectorService,
    private readonly sizeService: CompanySizeService,
    private readonly dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.loadCatalogs();

    toObservable(this.companyContext.selectedCompanyId, {
      injector: this.injector
    })
      .pipe(
        distinctUntilChanged(),
        switchMap(companyId => {
          this.company.set(null);
          this.error.set(false);

          if (companyId === null) {
            this.loading.set(false);
            return of(null);
          }

          return this.retryRequests$.pipe(
            startWith(void 0),
            switchMap(() => {
              this.loading.set(true);
              this.error.set(false);

              return this.membershipService
                .getCompany(companyId)
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
      .subscribe(company => {
        this.company.set(company);
        this.loading.set(false);
      });
  }

  private loadCatalogs(): void {
    this.sectorService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: sectors => this.sectors.set(sectors),
        error: () => this.sectors.set([])
      });

    this.sizeService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: sizes => this.sizes.set(sizes),
        error: () => this.sizes.set([])
      });
  }

  sectorName(id: number | null): string {
    if (id === null) {
      return 'Sin especificar';
    }

    return this.sectors().find(sector => sector.id === id)?.name
      ?? 'Sin especificar';
  }

  sizeName(id: number | null): string {
    if (id === null) {
      return 'Sin especificar';
    }

    return this.sizes().find(size => size.id === id)?.name
      ?? 'Sin especificar';
  }

  retryLoad(): void {
    if (!this.companyContext.selectedMembership()) {
      return;
    }

    this.retryRequests$.next();
  }

  openEditCompany(): void {
    const membership = this.companyContext.selectedMembership();

    if (!membership || !this.canEdit()) {
      return;
    }

    const companyId = membership.company_id;

    const dialogRef = this.dialog.open(CompanySettingsComponent, {
      width: '560px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      panelClass: 'company-edit-modal',
      autoFocus: 'first-tabbable',
      disableClose: true
    });

    dialogRef.afterClosed()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(saved => {
        if (
          saved === true &&
          this.companyContext.selectedCompanyId() === companyId
        ) {
          this.retryLoad();
        }
      });
  }
}
