import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AmbitsComponent } from './ambits.component';

describe('AmbitsComponent', () => {
  let component: AmbitsComponent;
  let fixture: ComponentFixture<AmbitsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AmbitsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AmbitsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
