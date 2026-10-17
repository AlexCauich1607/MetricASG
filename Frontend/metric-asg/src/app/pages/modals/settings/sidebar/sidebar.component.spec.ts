import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';

import { SidebarComponent } from './sidebar.component';
import { UserService } from '../../../../services/user.service';
import { CompanySectorService } from '../../../../services/company-sector.service';
import { CompanySizeService } from '../../../../services/company-size.service';

describe('SidebarComponent', () => {
  let component: SidebarComponent;
  let fixture: ComponentFixture<SidebarComponent>;

  const mockUser = {
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

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SidebarComponent
      ],
      providers: [
        provideHttpClient(withXhr()),
        {
          provide: UserService,
          useValue: {
            getById: () => of(mockUser)
          }
        },
        {
          provide: CompanySectorService,
          useValue: {
            getAll: () => of([])
          }
        },
        {
          provide: CompanySizeService,
          useValue: {
            getAll: () => of([])
          }
        },
        {
          provide: MatDialogRef,
          useValue: {
            close: () => {}
          }
        }
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
});