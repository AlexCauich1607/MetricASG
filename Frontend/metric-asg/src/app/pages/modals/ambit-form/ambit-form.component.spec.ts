import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';

import { AmbitFormComponent } from './ambit-form.component';

describe('AmbitFormComponent', () => {
  let component: AmbitFormComponent;
  let fixture: ComponentFixture<AmbitFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AmbitFormComponent],
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
        }]
    })
      .compileComponents();

    fixture = TestBed.createComponent(AmbitFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
