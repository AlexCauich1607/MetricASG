import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaturityLevelFormComponent } from './maturity-level-form.component';

describe('MaturityLevelFormComponent', () => {
  let component: MaturityLevelFormComponent;
  let fixture: ComponentFixture<MaturityLevelFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MaturityLevelFormComponent]
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
