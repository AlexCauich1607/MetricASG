import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';

import { FeedbacksFormComponent } from './feedbacks-form.component';

describe('FeedbacksFormComponent', () => {
  let component: FeedbacksFormComponent;
  let fixture: ComponentFixture<FeedbacksFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FeedbacksFormComponent],
      imports: [ReactiveFormsModule],
      providers: [
        provideHttpClient(withXhr()),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            id: 1,
            nivel: 1,
            name: 'Nivel de prueba'
          }
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

    fixture = TestBed.createComponent(FeedbacksFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
