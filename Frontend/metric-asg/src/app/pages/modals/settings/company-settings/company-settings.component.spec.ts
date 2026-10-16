import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

import { CompanySettingsComponent } from './company-settings.component';

describe('CompanySettingsComponent', () => {
  let component: CompanySettingsComponent;
  let fixture: ComponentFixture<CompanySettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CompanySettingsComponent],
      imports: [
        FormsModule
      ],
      providers: [
        provideHttpClient(withXhr())
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CompanySettingsComponent);
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
      phone: null,
      role: 'user',
      profile_photo: null,
      joined: '2026-01-01',
      last_login: '2026-01-01',
      biannual_evaluation: false,
      active: true,
      next_evaluation: '2026-07-01'
    };

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});