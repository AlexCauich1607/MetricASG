import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideHttpClient, withXhr } from '@angular/common/http';

import { MaturityLevelFormComponent } from './maturity-level-form.component';

describe('MaturityLevelFormComponent', () => {
  let component: MaturityLevelFormComponent;
  let fixture: ComponentFixture<MaturityLevelFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        MaturityLevelFormComponent
      ],
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

    fixture = TestBed.createComponent(MaturityLevelFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
