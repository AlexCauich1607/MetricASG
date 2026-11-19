import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild
} from '@angular/core';

import { RouterOutlet } from '@angular/router';
import { UserNavbarComponent } from '../user-navbar/user-navbar.component';
import { FooterComponent } from '../../../shared/footer/footer.component';

@Component({
  selector: 'app-user-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    UserNavbarComponent,
    FooterComponent
  ],
  templateUrl: './user-layout.component.html',
  changeDetection: ChangeDetectionStrategy.Eager,
  styleUrl: './user-layout.component.scss'
})
export class UserLayoutComponent implements AfterViewInit, OnDestroy {
  @ViewChild(UserNavbarComponent, { read: ElementRef })
  private navbarHost?: ElementRef<HTMLElement>;

  private resizeObserver?: ResizeObserver;
  private mutationObserver?: MutationObserver;

  ngAfterViewInit(): void {
    const navbar = this.navbarHost?.nativeElement.querySelector(
      '.navbar'
    ) as HTMLElement | null;

    const layout = this.navbarHost?.nativeElement.closest(
      '.app-layout'
    ) as HTMLElement | null;

    if (!navbar || !layout) {
      return;
    }

    const updateHeight = (): void => {
      const menu = navbar.querySelector('#mainNavbar');

      // Mantener la altura del navbar cerrado mientras
      // el menú móvil está expandido.
      if (
        menu?.classList.contains('show') ||
        menu?.classList.contains('collapsing')
      ) {
        return;
      }

      const height = Math.ceil(
        navbar.getBoundingClientRect().height
      );

      layout.style.setProperty(
        '--user-navbar-height',
        `${height}px`
      );
    };

    this.resizeObserver = new ResizeObserver(updateHeight);
    this.resizeObserver.observe(navbar);

    this.mutationObserver = new MutationObserver(updateHeight);

    const menu = navbar.querySelector('#mainNavbar');

    if (menu) {
      this.mutationObserver.observe(menu, {
        attributes: true,
        attributeFilter: ['class']
      });
    }

    updateHeight();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();
  }
}