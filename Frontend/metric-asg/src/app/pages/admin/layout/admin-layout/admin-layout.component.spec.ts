import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { RouterTestingModule } from '@angular/router/testing';

import { AdminLayoutComponent } from './admin-layout.component';
import { SidebarComponent } from '../../sidebar/sidebar.component';

describe('AdminLayoutComponent', () => {
  let component: AdminLayoutComponent;
  let fixture: ComponentFixture<AdminLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        AdminLayoutComponent,
        SidebarComponent
      ],
      imports: [
        RouterTestingModule
      ],
      providers: [
        provideHttpClient(withXhr())
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});