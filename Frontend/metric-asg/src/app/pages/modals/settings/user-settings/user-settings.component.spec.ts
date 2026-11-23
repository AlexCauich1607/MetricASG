import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';

import { UserSettingsComponent } from './user-settings.component';

describe('UserSettingsComponent', () => {
  let component: UserSettingsComponent;
  let fixture: ComponentFixture<UserSettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserSettingsComponent],
      providers: [
        provideHttpClient(withXhr())
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserSettingsComponent);
    component = fixture.componentInstance;

    component.user = {
      id: 1,
      name: 'Usuario',
      lastname: 'Prueba',
      position: 'Administrador',
      email: 'test@example.com',
      phone: null,
      role: 'user',
      profile_photo: null,
      joined: '2026-01-01',
      last_login: '2026-01-01',
      active: true,
    };

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});