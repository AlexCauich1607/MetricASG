import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

import { SizeFormComponent } from './size-form.component';

describe('SizeFormComponent', () => {
  let component: SizeFormComponent;
  let fixture: ComponentFixture<SizeFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SizeFormComponent],
      providers: [
        provideHttpClient(withXhr()),
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            size: undefined
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

    fixture = TestBed.createComponent(SizeFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});