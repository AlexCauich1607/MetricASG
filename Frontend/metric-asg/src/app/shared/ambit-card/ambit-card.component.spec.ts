import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AmbitCardComponent } from './ambit-card.component';

describe('AmbitCardComponent', () => {
  let component: AmbitCardComponent;
  let fixture: ComponentFixture<AmbitCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AmbitCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AmbitCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
