import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { ReportModalComponent } from './report-modal.component';

describe('ReportModalComponent', () => {
  let component: ReportModalComponent;
  let fixture: ComponentFixture<ReportModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        ReportModalComponent
      ],
      providers: [
        {
          provide: MatDialogRef,
          useValue: {
            close: jasmine.createSpy('close'),
            updateSize: jasmine.createSpy('updateSize')
          }
        },
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            name: 'Empresa de prueba',
            results: {
              evaluation_id: 1,
              date: '2026-10-08',
              global_score: 80,
              global_maturity_level: 'Avanzado',
              ambits: []
            }
          }
        }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(ReportModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
