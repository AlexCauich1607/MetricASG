import { CompanyRole } from '../../../models/company_membership';
import {
  Component,
  ChangeDetectionStrategy,
  OnInit
} from '@angular/core';

import {
  RouterLink,
  RouterLinkActive,
  Router
} from '@angular/router';

import { MatDialog } from '@angular/material/dialog';
import { finalize } from 'rxjs';

import { SessionService } from '../../../shared/class/temporalStorage';
import { SidebarComponent } from '../../modals/settings/sidebar/sidebar.component';
import { AuthService } from '../../../services/auth.service';
import { NotificationService } from '../../../services/notification.service';
import { CompanyContextService } from '../../../services/company-context.service';
import {
  ReevaluationNotification,
  ReminderType
} from '../../../models/notification';

import { CreateCompanyComponent } from '../../modals/create-company/create-company.component';
import { CompanyCreateResponse } from '../../../models/company_membership';

import {
  ElementRef,
  HostListener,
  ViewChild
} from '@angular/core';


@Component({
  selector: 'app-user-navbar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './user-navbar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './user-navbar.component.scss'
})
export class UserNavbarComponent implements OnInit {

  photo = SessionService.getSessionItem('photo');

  notifications: ReevaluationNotification[] = [];
  notificationsLoading = false;
  notificationsError = false;

  constructor(
    private router: Router,
    private dialog: MatDialog,
    private authService: AuthService,
    private notificationService: NotificationService,
    public companyContext: CompanyContextService
  ) { }

  ngOnInit(): void {
    this.loadNotifications();
    this.companyContext.loadMemberships();
  }
  get canManageMembers(): boolean {
    return this.companyContext.selectedRole() === CompanyRole.COMPANY_ADMIN;
  }
  getCompanyRoleLabel(): string {
    switch (this.companyContext.selectedRole()) {
      case CompanyRole.COMPANY_ADMIN:
        return 'Administrador empresarial';

      case CompanyRole.ASG_MANAGER:
        return 'Responsable ASG';

      case CompanyRole.COLLABORATOR:
        return 'Colaborador';

      case CompanyRole.AUDITOR:
        return 'Auditor';

      default:
        return '';
    }
  }

  loadNotifications(): void {
    this.notificationsLoading = true;
    this.notificationsError = false;

    this.notificationService.getMyNotifications()
      .pipe(
        finalize(() => {
          this.notificationsLoading = false;
        })
      )
      .subscribe({
        next: (notifications) => {
          this.notifications = notifications;
        },
        error: () => {
          this.notifications = [];
          this.notificationsError = true;
        }
      });
  }

  getReminderTitle(type: ReminderType): string {
    switch (type) {
      case 'FIRST':
        return 'Próxima evaluación ASG';

      case 'SECOND':
        return 'Recordatorio de evaluación';

      case 'DUE':
        return 'Fecha de evaluación';

      default:
        return 'Recordatorio ASG';
    }
  }

  getReminderMessage(notification: ReevaluationNotification): string {
    switch (notification.reminder_type) {
      case 'FIRST':
        return 'Faltan 30 días para tu próxima evaluación.';

      case 'SECOND':
        return 'Faltan 7 días para tu próxima evaluación.';

      case 'DUE':
        return 'Hoy corresponde realizar tu próxima evaluación.';

      default:
        return 'Tienes un recordatorio de evaluación.';
    }
  }

  formatReminderDate(date: string): string {
    const [year, month, day] = date.split('-');

    return `${day}/${month}/${year}`;
  }

  cerrarSesion(): void {
    this.authService.logout()
      .pipe(
        finalize(() => {
          this.companyContext.clear();
          SessionService.logout();
          this.router.navigate(['/home']);
        })
      )
      .subscribe({
        error: () => { }
      });
  }
  selectCompany(companyId: number): void {
    if (this.companySelectionLocked) {
      return;
    }

    this.companyContext.selectCompany(companyId);
  }
  getImage(): string {
    return 'data:image/jpeg;base64,' + this.photo;
  }

  openConfiguration(): void {
    const dialogRef = this.dialog.open(
      SidebarComponent,
      {
        width: '900px',
        height: '500px'
      }
    );

    dialogRef.afterClosed().subscribe();
  }

  get companySelectionLocked(): boolean {
    return this.router.url.split('?')[0].split('#')[0] === '/user/evaluation';
  }
  @ViewChild('navbarToggler')
  private navbarToggler?: ElementRef<HTMLButtonElement>;

  @ViewChild('navbarCollapse')
  private navbarCollapse?: ElementRef<HTMLElement>;

  @HostListener('document:keydown.escape')
  onEscape(): void {
    const menu = this.navbarCollapse?.nativeElement;
    const toggler = this.navbarToggler?.nativeElement;

    if (!menu || !toggler || !menu.classList.contains('show')) {
      return;
    }

    // Bootstrap gestiona el cierre y actualiza aria-expanded.
    toggler.click();

    // Devolver el foco al botón hamburguesa.
    toggler.focus();
  }
  openCreateCompany(): void {
    if (this.companySelectionLocked) {
      return;
    }

    const dialogRef = this.dialog.open(
      CreateCompanyComponent,
      {
        width: '520px',
        maxWidth: '95vw',
        disableClose: true
      }
    );

    dialogRef.afterClosed().subscribe(
      (company: CompanyCreateResponse | null | undefined) => {
        if (!company) {
          return;
        }

        this.companyContext.loadMemberships(company.id);
      }
    );
  }
}
