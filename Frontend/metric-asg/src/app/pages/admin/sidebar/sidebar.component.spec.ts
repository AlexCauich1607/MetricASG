import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SidebarComponent
      ],
      providers: [
        provideHttpClient(withXhr()),
        provideRouter([])
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should start with the sidebar closed', () => {
    expect(component.isOpen).toBeFalse();
  });

  it('should close the sidebar with Escape', () => {
    component.isOpen = true;

    component.onEscape();
    fixture.detectChanges();

    expect(component.isOpen).toBeFalse();
  });

  it('should not close an already closed sidebar', () => {
    component.isOpen = false;

    component.onEscape();

    expect(component.isOpen).toBeFalse();
  });

  it('should mark mobile sidebar as inert when closed', () => {
    component.isMobile = true;
    component.isOpen = false;
    fixture.detectChanges();

    const nav: HTMLElement =
      fixture.nativeElement.querySelector(
        '#admin-sidebar-navigation'
      );

    expect(nav.hasAttribute('inert')).toBeTrue();
  });

  it('should remove inert when mobile sidebar is open', () => {
    component.isMobile = true;
    component.isOpen = true;
    fixture.detectChanges();

    const nav: HTMLElement =
      fixture.nativeElement.querySelector(
        '#admin-sidebar-navigation'
      );

    expect(nav.hasAttribute('inert')).toBeFalse();
  });

  it('should keep desktop navigation interactive', () => {
    component.isMobile = false;
    component.isOpen = false;
    fixture.detectChanges();

    const nav: HTMLElement =
      fixture.nativeElement.querySelector(
        '#admin-sidebar-navigation'
      );

    expect(nav.hasAttribute('inert')).toBeFalse();
  });

  it('should update aria-expanded according to sidebar state', () => {
    component.isMobile = true;
    component.isOpen = false;
    fixture.detectChanges();

    const trigger: HTMLButtonElement =
      fixture.nativeElement.querySelector(
        '[aria-controls="admin-sidebar-navigation"]'
      );

    expect(trigger.getAttribute('aria-expanded')).toBe('false');

    component.isOpen = true;
    fixture.detectChanges();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
  });

  it('should close the sidebar when Escape is pressed', () => {
    component.isOpen = true;
    fixture.detectChanges();

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true
      })
    );

    fixture.detectChanges();

    expect(component.isOpen).toBeFalse();
  });

  it('should close the mobile sidebar when navigating', () => {
    component.isMobile = true;
    component.isOpen = true;

    component.closeOnMobile();
    fixture.detectChanges();

    expect(component.isOpen).toBeFalse();
  });

});
