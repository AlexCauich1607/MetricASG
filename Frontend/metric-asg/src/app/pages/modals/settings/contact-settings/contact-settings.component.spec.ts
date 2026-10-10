import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { ContactSettingsComponent } from './contact-settings.component';

describe('ContactSettingsComponent', () => {
  let component: ContactSettingsComponent;
  let fixture: ComponentFixture<ContactSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ContactSettingsComponent],
      imports: [
        FormsModule
      ],
      providers: [
        provideHttpClient()
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
      company_name: 'Empresa de prueba',
      company_sector_id: null,
      company_size_id: null,
      email: 'test@example.com',
      phone: '',
      role: 'user',
      profile_photo: null,
      joined: '2026-01-01',
      last_login: '2026-01-01',
      biannual_evaluation: false,
      active: true,
      next_evaluation: '2026-07-01'
    };

    component.tel_bf = component.user.phone;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});