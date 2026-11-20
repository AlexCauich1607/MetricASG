
import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  afterNextRender,
  ChangeDetectorRef
} from '@angular/core';
import { SessionService } from '../../../shared/class/temporalStorage';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive
  ],
  templateUrl: './sidebar.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './sidebar.component.scss'
})
export class SidebarComponent implements OnDestroy {
  isOpen = false;

  isMobile = typeof window !== 'undefined'
    ? window.innerWidth < 768
    : false;

  @ViewChild('menuTrigger')
  menuTrigger?: ElementRef<HTMLButtonElement>;

  @ViewChild('closeButton')
  closeButton?: ElementRef<HTMLButtonElement>;

  @ViewChild('sidebarNav')
  sidebarNav?: ElementRef<HTMLElement>;

  private previousBodyOverflow = '';

  constructor(
    private router: Router,
    private authService: AuthService,
    private cdr: ChangeDetectorRef
  ) { }

  toggleSidebar(): void {
    if (this.isOpen) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  private openSidebar(): void {
    if (window.innerWidth >= 768) return;

    this.isOpen = true;

    this.previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    this.cdr.detectChanges();

    requestAnimationFrame(() => {
      this.closeButton?.nativeElement.focus();
    });
  }

  private closeSidebar(restoreFocus = true): void {
    if (!this.isOpen) return;

    this.isOpen = false;
    document.body.style.overflow = this.previousBodyOverflow;

    this.cdr.detectChanges();

    if (restoreFocus) {
      requestAnimationFrame(() => {
        this.menuTrigger?.nativeElement.focus();
      });
    }
  }

  closeOnMobile(): void {
    if (this.isMobile) {
      this.closeSidebar(false);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeSidebar();
  }


  @HostListener('document:keydown', ['$event'])
  onTab(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;

    if (
      keyboardEvent.key !== 'Tab' ||
      !this.isOpen ||
      !this.isMobile
    ) {
      return;
    }

    const nav = this.sidebarNav?.nativeElement;
    if (!nav) return;

    const focusables = Array.from(
      nav.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter(element =>
      element.getClientRects().length > 0 &&
      !element.closest('[inert]')
    );

    if (focusables.length === 0) {
      keyboardEvent.preventDefault();
      nav.focus();
      return;
    }

    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;

    if (keyboardEvent.shiftKey) {
      if (active === first || !nav.contains(active)) {
        keyboardEvent.preventDefault();
        last.focus();
      }
    } else {
      if (active === last || !nav.contains(active)) {
        keyboardEvent.preventDefault();
        first.focus();
      }
    }
  }

  @HostListener('window:resize')
  onResize(): void {
    this.isMobile = window.innerWidth < 768;

    if (!this.isMobile && this.isOpen) {
      this.closeSidebar(false);
    }
  }

  ngOnDestroy(): void {
    if (typeof document !== 'undefined') {
      document.body.style.overflow = this.previousBodyOverflow;
    }
  }

  close(): void {
    this.authService.logout()
      .pipe(
        finalize(() => {
          SessionService.logout();
          this.router.navigate(['/home']);
        })
      )
      .subscribe({
        error: () => { }
      });
  }
}
