import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FeedbacksFormComponent } from './feedbacks-form.component';

describe('FeedbacksFormComponent', () => {
  let component: FeedbacksFormComponent;
  let fixture: ComponentFixture<FeedbacksFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FeedbacksFormComponent]
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
