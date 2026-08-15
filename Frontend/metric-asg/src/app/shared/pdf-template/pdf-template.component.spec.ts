import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PdfReportTemplateComponent } from './pdf-template.component';

describe('PdfTemplateComponent', () => {
  let component: PdfReportTemplateComponent;
  let fixture: ComponentFixture<PdfReportTemplateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PdfReportTemplateComponent]
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
