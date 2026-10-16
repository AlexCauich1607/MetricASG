import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';

import { UserFormComponent } from './user-form.component';

describe('UserFormComponent', () => {
  let component: UserFormComponent;
  let fixture: ComponentFixture<UserFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [UserFormComponent],
      imports: [ReactiveFormsModule],
      providers: [
        provideHttpClient(withXhr()),
        {
          provide: MAT_DIALOG_DATA,
          useValue: undefined
        },
        {
          provide: MatDialogRef,
          useValue: {
            close: jasmine.createSpy('close')
          }
        }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(UserFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
