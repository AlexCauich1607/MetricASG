import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { of } from 'rxjs';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SingUpComponent } from './sing-up.component';

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

});