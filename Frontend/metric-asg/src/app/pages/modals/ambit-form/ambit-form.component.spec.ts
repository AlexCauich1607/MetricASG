import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AmbitFormComponent } from './ambit-form.component';

describe('AmbitFormComponent', () => {
  let component: AmbitFormComponent;
  let fixture: ComponentFixture<AmbitFormComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AmbitFormComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AmbitFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
