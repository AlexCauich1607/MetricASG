import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { SharedModule } from '../../../shared/shared.module';

import { UserLayoutComponent } from './user-layout.component';
import { UserNavbarComponent } from '../user-navbar/user-navbar.component';

describe('UserLayoutComponent', () => {
  let component: UserLayoutComponent;
  let fixture: ComponentFixture<UserLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        UserLayoutComponent,
        UserNavbarComponent
      ],
      providers: [
        provideHttpClient()
      ],
      imports: [
        RouterModule.forRoot([]),
        SharedModule
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});