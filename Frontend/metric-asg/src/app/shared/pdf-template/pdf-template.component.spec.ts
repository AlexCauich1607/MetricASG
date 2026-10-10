import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedModule } from '../shared.module';

import { PdfReportTemplateComponent } from './pdf-template.component';

describe('PdfReportTemplateComponent', () => {
  let component: PdfReportTemplateComponent;
  let fixture: ComponentFixture<PdfReportTemplateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SharedModule
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(PdfReportTemplateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});