import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { IndicatorsFormComponent } from './indicators-form.component';

describe('IndicatorsFormComponent', () => {
  let component: IndicatorsFormComponent;
  let fixture: ComponentFixture<IndicatorsFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        IndicatorsFormComponent
      ],
      providers: [
        provideHttpClient(withXhr()),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            id: 1,
            indicator: undefined
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

    fixture = TestBed.createComponent(IndicatorsFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
