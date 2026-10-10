import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { SharedModule } from '../../../shared/shared.module';

import { CompanyComponent } from './company.component';

describe('CompanyComponent', () => {
  let component: CompanyComponent;
  let fixture: ComponentFixture<CompanyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CompanyComponent],
      providers: [
        provideHttpClient()
      ],
      imports: [
        SharedModule
      ],
    })
      .compileComponents();

    fixture = TestBed.createComponent(CompanyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
