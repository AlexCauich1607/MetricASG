
import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  Injector,
  OnInit,
  computed,
  inject,
  signal
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  distinctUntilChanged,
  finalize,
  of,
  Subject,
  startWith,
  switchMap,
  takeUntil
} from 'rxjs';

import { CompanyContextService } from '../../../../services/company-context.service';
import { CompanyMembershipService } from '../../../../services/company-membership.service';
import {
  CompanyDetailResponse,
  CompanyRole,
  CompanyUpdateRequest
} from '../../../../models/company_membership';
import { CompanySectorService } from '../../../../services/company-sector.service';
import { CompanySizeService } from '../../../../services/company-size.service';
import { CompanySector } from '../../../../models/company_sector';
import { CompanySize } from '../../../../models/company_size';
import { MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-company-settings',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './company-settings.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './company-settings.component.scss'
})
export class CompanySettingsComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  readonly company = signal<CompanyDetailResponse | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly saveSuccess = signal(false);

  readonly sectors = signal<CompanySector[]>([]);
  readonly sizes = signal<CompanySize[]>([]);

  readonly name = signal('');
  readonly sectorId = signal<number | null>(null);
  readonly sizeId = signal<number | null>(null);

  readonly canEdit = computed(
    () =>
      this.companyContext.selectedRole() ===
      CompanyRole.COMPANY_ADMIN
  );

  private readonly retryRequests$ = new Subject<void>();
  private readonly cancelSave$ = new Subject<void>();
  private readonly dialogRef = inject(
    MatDialogRef<CompanySettingsComponent>,
    { optional: true }
  );

  constructor(
    public readonly companyContext: CompanyContextService,
    private readonly membershipService: CompanyMembershipService,
    private readonly sectorService: CompanySectorService,
    private readonly sizeService: CompanySizeService
  ) { }

  ngOnInit(): void {
    this.loadCatalogs();

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
          this.cancelSave$.next();

          this.company.set(null);
          this.name.set('');
          this.sectorId.set(null);
          this.sizeId.set(null);
          this.saveSuccess.set(false);
          this.saveError.set(null);
          this.saving.set(false);
          this.error.set(false);

          if (!membership) {
            this.loading.set(false);
            return of(null);
          }

          return this.retryRequests$.pipe(
            startWith(void 0),
            switchMap(() => {
              this.loading.set(true);
              this.error.set(false);

              return this.membershipService
                .getCompany(membership.company_id)
                .pipe(
                  catchError(() => {
                    this.error.set(true);
                    return of(null);
                  }),
                  finalize(() => this.loading.set(false))
                );
            })
          );
        }),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(company => {
        if (company !== null) {
          this.company.set(company);
          this.name.set(company.name);
          this.sectorId.set(company.sector_id);
          this.sizeId.set(company.size_id);
        }
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

  retryLoad(): void {
    this.retryRequests$.next();
  }

  closeDialog(): void {
    if (this.saving()) {
      return;
    }

    this.dialogRef?.close(false);
  }

  update(): void {
    const company = this.company();
    const membership = this.companyContext.selectedMembership();
    const name = this.name().trim();

    if (
      !company ||
      !membership ||
      membership.company_id !== company.id ||
      !this.canEdit() ||
      this.saving() ||
      !name ||
      name.length > 150
    ) {
      return;
    }

    const companyId = company.id;

    const payload: CompanyUpdateRequest = {
      name,
      sector_id: this.sectorId(),
      size_id: this.sizeId()
    };

    this.saveSuccess.set(false);
    this.saveError.set(null);
    this.saving.set(true);

    this.membershipService.updateCompany(companyId, payload)
      .pipe(
        takeUntil(this.cancelSave$),
        takeUntilDestroyed(this.destroyRef)
      )

      .subscribe({
        next: updated => {
          if (
            this.companyContext.selectedCompanyId() !== companyId
          ) {
            return;
          }

          this.saving.set(false);
          this.company.set(updated);
          this.name.set(updated.name);
          this.sectorId.set(updated.sector_id);
          this.sizeId.set(updated.size_id);
          this.saveSuccess.set(true);

          this.companyContext.loadMemberships(companyId);

          // Cerrar únicamente cuando se utiliza como modal.
          this.dialogRef?.close(true);
        },
        error: () => {
          if (
            this.companyContext.selectedCompanyId() !== companyId
          ) {
            return;
          }

          this.saving.set(false);
          this.saveError.set(
            'No fue posible actualizar la información de la empresa.'
          );
        }
      });
  }
}
