import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { MatStepperModule } from '@angular/material/stepper';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

import { SingUpComponent } from './sing-up.component';

describe('SingUpComponent', () => {
  let component: SingUpComponent;
  let fixture: ComponentFixture<SingUpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SingUpComponent],
      providers: [
        provideHttpClient()
      ],
      imports: [
        MatStepperModule,
        ReactiveFormsModule,
        FormsModule
      ],
    })
      .compileComponents();

    fixture = TestBed.createComponent(SingUpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});