
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiStateComponent } from './ui-state.component';

describe('UiStateComponent', () => {
  let component: UiStateComponent;
  let fixture: ComponentFixture<UiStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UiStateComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(UiStateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('debe crearse correctamente', () => {
    expect(component).toBeTruthy();
  });

  it('debe mostrar título y mensaje', () => {
    fixture.componentRef.setInput('title', 'Sin evaluaciones');
    fixture.componentRef.setInput('message', 'Todavía no existen registros.');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(element.textContent).toContain('Sin evaluaciones');
    expect(element.textContent).toContain('Todavía no existen registros.');
  });

  it('debe mostrar el estado de carga', () => {
    fixture.componentRef.setInput('type', 'loading');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const state = element.querySelector('.asg-state');

    expect(state?.classList.contains('asg-state--loading')).toBeTrue();
    expect(state?.getAttribute('role')).toBe('status');
    expect(state?.getAttribute('aria-busy')).toBe('true');
    expect(element.querySelector('.asg-state__spinner')).not.toBeNull();
  });

  it('debe anunciar errores mediante role alert', () => {
    fixture.componentRef.setInput('type', 'error');
    fixture.componentRef.setInput('title', 'Error al cargar');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const state = element.querySelector('.asg-state');

    expect(state?.getAttribute('role')).toBe('alert');
    expect(state?.classList.contains('asg-state--error')).toBeTrue();
  });

  it('debe mostrar el estado vacío', () => {
    fixture.componentRef.setInput('type', 'empty');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const state = element.querySelector('.asg-state');

    expect(state?.classList.contains('asg-state--empty')).toBeTrue();
    expect(state?.getAttribute('role')).toBe('status');
  });

  it('debe mostrar el estado de éxito', () => {
    fixture.componentRef.setInput('type', 'success');
    fixture.componentRef.setInput('title', 'Guardado correctamente');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const state = element.querySelector('.asg-state');

    expect(state?.classList.contains('asg-state--success')).toBeTrue();
    expect(element.textContent).toContain('Guardado correctamente');
  });

  it('no debe marcar como ocupado un estado distinto de loading', () => {
    fixture.componentRef.setInput('type', 'success');
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    const state = element.querySelector('.asg-state');

    expect(state?.hasAttribute('aria-busy')).toBeFalse();
  });
});
