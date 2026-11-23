import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';

import { ContactSettingsComponent } from './contact-settings.component';

describe('ContactSettingsComponent', () => {
  let component: ContactSettingsComponent;
  let fixture: ComponentFixture<ContactSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ContactSettingsComponent
      ],
      providers: [
        provideHttpClient(withXhr())
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ContactSettingsComponent);
    component = fixture.componentInstance;

    component.user = {
      id: 1,
      name: 'Usuario',
      lastname: 'Prueba',
      position: 'Administrador',
      email: 'test@example.com',
      phone: '',
      role: 'user',
      profile_photo: null,
      joined: '2026-01-01',
      last_login: '2026-01-01',
      active: true,
    };

    component.tel_bf = component.user.phone;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});