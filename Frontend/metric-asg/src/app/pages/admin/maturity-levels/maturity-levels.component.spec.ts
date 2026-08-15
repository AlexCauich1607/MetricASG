import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MaturityLevelsComponent } from './maturity-levels.component';

describe('MaturityLevelsComponent', () => {
  let component: MaturityLevelsComponent;
  let fixture: ComponentFixture<MaturityLevelsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [MaturityLevelsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MaturityLevelsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
