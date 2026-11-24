import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SingUpComponent } from './sing-up.component';
import { MatStepper } from '@angular/material/stepper';
import { By } from '@angular/platform-browser';

describe('SingUpComponent', () => {
  let component: SingUpComponent;
  let fixture: ComponentFixture<SingUpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SingUpComponent
      ],
      providers: [
        provideHttpClient(withXhr())
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(SingUpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
  it('should contain only personal registration fields', () => {
    const expectedFields = [
      'name',
      'lastname',
      'position',
      'email',
      'phone',
      'password'
    ];

    expect(Object.keys(component.form.controls))
      .toEqual(expectedFields);

    expect(component.form.get('company_name')).toBeNull();
    expect(component.form.get('company_sector_id')).toBeNull();
    expect(component.form.get('company_size_id')).toBeNull();
  });

  it('should reject an incomplete personal registration form', () => {
    expect(component.form.invalid).toBeTrue();

    component.form.patchValue({
      name: 'Alex',
      lastname: 'Cauich',
      position: 'Developer',
      email: 'invalid-email',
      phone: '9999999999',
      password: 'Password123!'
    });

    expect(component.form.invalid).toBeTrue();

    component.form.patchValue({
      email: 'personal@test.com'
    });

    expect(component.form.valid).toBeTrue();
  });
  it('should submit personal registration and navigate to login', () => {
    const authService = TestBed.inject(AuthService);
    const router = TestBed.inject(Router);

    const createUserSpy = spyOn(authService, 'createUser').and.returnValue(
      of({ id: 10 } as any)
    );

    const navigateSpy = spyOn(router, 'navigate').and.resolveTo(true);
    spyOn(window, 'alert');

    component.form.setValue({
      name: 'Alex',
      lastname: 'Cauich',
      position: 'Developer',
      email: 'personal@test.com',
      phone: '9999999999',
      password: 'Password123!'
    });

    component.r_password = 'Password123!';

    expect(component.form.valid).toBeTrue();
    expect(component.validatePhone()).toBeTrue();
    expect(component.validatePassword()).toBeTrue();

    component.register();

    expect(createUserSpy).toHaveBeenCalledOnceWith({
      name: 'Alex',
      lastname: 'Cauich',
      position: 'Developer',
      email: 'personal@test.com',
      phone: '9999999999',
      password: 'Password123!'
    });

    expect(navigateSpy).toHaveBeenCalledOnceWith(['/login']);
  });

  it('should toggle password fields independently without changing their values', async () => {
    // 1. Completar la información personal.
    component.form.patchValue({
      name: 'Alex',
      lastname: 'Cauich',
      position: 'Developer'
    });

    fixture.detectChanges();

    // 2. Acceder al segundo paso del registro.
    const stepper = fixture.debugElement
      .query(By.directive(MatStepper))
      .componentInstance as MatStepper;

    stepper.selectedIndex = 1;
    fixture.detectChanges();

    await fixture.whenStable();
    fixture.detectChanges();

    // 3. Obtener los campos de contraseña.
    const password: HTMLInputElement =
      fixture.nativeElement.querySelector('#password');

    const confirmation: HTMLInputElement =
      fixture.nativeElement.querySelector('#r_password');

    expect(password).not.toBeNull();
    expect(confirmation).not.toBeNull();

    // 4. Simular la escritura del usuario en ambos campos.
    password.value = 'Password123!';
    password.dispatchEvent(new Event('input', { bubbles: true }));

    confirmation.value = 'Password123!';
    confirmation.dispatchEvent(new Event('input', { bubbles: true }));

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const toggles: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('.toggle-password');

    expect(toggles.length).toBe(2);

    // 5. Estado inicial: ambas contraseñas ocultas.
    expect(password.type).toBe('password');
    expect(confirmation.type).toBe('password');

    expect(toggles[0].getAttribute('aria-pressed')).toBe('false');
    expect(toggles[1].getAttribute('aria-pressed')).toBe('false');

    expect(toggles[0].getAttribute('aria-label'))
      .toBe('Mostrar contraseña');

    expect(toggles[1].getAttribute('aria-label'))
      .toBe('Mostrar confirmación de contraseña');

    // 6. Mostrar únicamente la contraseña principal.
    toggles[0].click();
    fixture.detectChanges();

    expect(password.type).toBe('text');
    expect(confirmation.type).toBe('password');

    expect(toggles[0].getAttribute('aria-pressed')).toBe('true');
    expect(toggles[1].getAttribute('aria-pressed')).toBe('false');

    expect(toggles[0].getAttribute('aria-label'))
      .toBe('Ocultar contraseña');

    // 7. Mostrar también la confirmación.
    toggles[1].click();
    fixture.detectChanges();

    expect(password.type).toBe('text');
    expect(confirmation.type).toBe('text');

    expect(toggles[0].getAttribute('aria-pressed')).toBe('true');
    expect(toggles[1].getAttribute('aria-pressed')).toBe('true');

    expect(toggles[1].getAttribute('aria-label'))
      .toBe('Ocultar confirmación de contraseña');

    // 8. Ocultar únicamente la contraseña principal.
    toggles[0].click();
    fixture.detectChanges();

    expect(password.type).toBe('password');
    expect(confirmation.type).toBe('text');

    expect(toggles[0].getAttribute('aria-pressed')).toBe('false');
    expect(toggles[1].getAttribute('aria-pressed')).toBe('true');

    // 9. Ocultar la confirmación.
    toggles[1].click();
    fixture.detectChanges();

    expect(password.type).toBe('password');
    expect(confirmation.type).toBe('password');

    expect(toggles[0].getAttribute('aria-pressed')).toBe('false');
    expect(toggles[1].getAttribute('aria-pressed')).toBe('false');

    expect(toggles[1].getAttribute('aria-label'))
      .toBe('Mostrar confirmación de contraseña');

    // 10. Verificar que los valores se conservaron.
    expect(password.value).toBe('Password123!');
    expect(confirmation.value).toBe('Password123!');

    expect(component.form.get('password')?.value)
      .toBe('Password123!');

    expect(component.r_password)
      .toBe('Password123!');

    // 11. Verificar que sigue funcionando la validación.
    expect(component.validatePassword()).toBeTrue();
  });
  it('should reject registration when password confirmation is missing or different', () => {
    const authService = TestBed.inject(AuthService);

    const createUserSpy = spyOn(authService, 'createUser');
    const alertSpy = spyOn(window, 'alert');

    component.form.setValue({
      name: 'Alex',
      lastname: 'Cauich',
      position: 'Developer',
      email: 'personal@test.com',
      phone: '9999999999',
      password: 'Password123!'
    });

    expect(component.form.valid).toBeTrue();

    // Caso 1: confirmación vacía.
    component.r_password = '';

    expect(component.validatePassword()).toBeFalse();

    component.register();

    expect(createUserSpy).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(
      'Las contraseñas no coinciden'
    );

    // Caso 2: confirmación diferente.
    alertSpy.calls.reset();

    component.r_password = 'Different123!';

    expect(component.validatePassword()).toBeFalse();

    component.register();

    expect(createUserSpy).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledOnceWith(
      'Las contraseñas no coinciden'
    );
  });
});