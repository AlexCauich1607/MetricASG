
import {
  ComponentFixture,
  TestBed
} from '@angular/core/testing';

import {
  ResultsEvidencesComponent
} from './results-evidences.component';

import {
  EvaluationEvidence
} from '../../../../models/evaluation_evidence';

describe('ResultsEvidencesComponent', () => {

  let component: ResultsEvidencesComponent;

  let fixture: ComponentFixture<ResultsEvidencesComponent>;

  const fileEvidence = {
    id: 1,
    indicator_id: 12,
    type: 'FILE',
    original_filename: 'reporte.pdf'
  } as EvaluationEvidence;

  const commentEvidence = {
    id: 2,
    indicator_id: 5,
    type: 'COMMENT',
    content: 'Comentario de prueba'
  } as EvaluationEvidence;

  const urlEvidence = {
    id: 3,
    indicator_id: 12,
    type: 'URL',
    content: 'https://example.com'
  } as EvaluationEvidence;

  beforeEach(async () => {

    await TestBed.configureTestingModule({
      imports: [ResultsEvidencesComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(
      ResultsEvidencesComponent
    );

    component = fixture.componentInstance;

    fixture.detectChanges();

  });

  function expandPanel(): void {

    const details: HTMLDetailsElement =
      fixture.nativeElement.querySelector('details');

    details.open = true;

    fixture.detectChanges();

  }

  it('should create', () => {

    expect(component).toBeTruthy();

  });

  it('should initialize with the panel collapsed', () => {

    const details: HTMLDetailsElement =
      fixture.nativeElement.querySelector('details');

    expect(details.open).toBeFalse();

  });

  it('should show the empty state', () => {

    expandPanel();

    expect(fixture.nativeElement.textContent)
      .toContain('Sin evidencias registradas');

  });

  it('should show the loading state', () => {

    fixture.componentRef.setInput('loading', true);

    fixture.detectChanges();

    expandPanel();

    expect(fixture.nativeElement.textContent)
      .toContain('Cargando evidencias');

    expect(fixture.nativeElement.textContent)
      .not.toContain('Sin evidencias registradas');

  });

  it('should emit retry when the user requests it', () => {

    const retrySpy = spyOn(component.retry, 'emit');

    fixture.componentRef.setInput('error', true);

    fixture.detectChanges();

    expandPanel();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('button');

    button.click();

    expect(retrySpy).toHaveBeenCalledTimes(1);

  });

  it('should prevent retry while loading', () => {

    const retrySpy = spyOn(component.retry, 'emit');

    fixture.componentRef.setInput('loading', true);

    component.requestRetry();

    expect(retrySpy).not.toHaveBeenCalled();

  });

  it('should group indicators without duplicates', () => {

    fixture.componentRef.setInput(
      'evidences',
      [fileEvidence, commentEvidence, urlEvidence]
    );

    fixture.detectChanges();

    expect(component.getEvidenceIndicatorIds())
      .toEqual([5, 12]);

  });

  it('should render comments, URLs and files', () => {

    fixture.componentRef.setInput(
      'evidences',
      [fileEvidence, commentEvidence, urlEvidence]
    );

    fixture.detectChanges();

    expandPanel();

    expect(fixture.nativeElement.textContent)
      .toContain('Comentario de prueba');

    expect(fixture.nativeElement.textContent)
      .toContain('reporte.pdf');

    const link: HTMLAnchorElement =
      fixture.nativeElement.querySelector('a');

    expect(link.getAttribute('href'))
      .toBe('https://example.com');

    expect(link.getAttribute('rel'))
      .toBe('noopener noreferrer');

  });

  it('should emit download for a file evidence', () => {

    const downloadSpy = spyOn(
      component.download,
      'emit'
    );

    fixture.componentRef.setInput(
      'evidences',
      [fileEvidence]
    );

    fixture.detectChanges();

    expandPanel();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector(
        '.results-evidences__download'
      );

    button.click();

    expect(downloadSpy)
      .toHaveBeenCalledOnceWith(fileEvidence);

  });

  it('should not download comment or URL evidence', () => {

    const downloadSpy = spyOn(
      component.download,
      'emit'
    );

    component.requestDownload(commentEvidence);

    component.requestDownload(urlEvidence);

    expect(downloadSpy).not.toHaveBeenCalled();

  });

  it('should prevent concurrent downloads', () => {

    const downloadSpy = spyOn(
      component.download,
      'emit'
    );

    fixture.componentRef.setInput(
      'evidences',
      [fileEvidence]
    );

    fixture.componentRef.setInput(
      'downloadingEvidenceId',
      fileEvidence.id
    );

    fixture.detectChanges();

    expandPanel();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector(
        '.results-evidences__download'
      );

    expect(button.disabled).toBeTrue();

    expect(button.textContent)
      .toContain('Descargando');

    component.requestDownload(fileEvidence);

    expect(downloadSpy).not.toHaveBeenCalled();

  });

  it('should display download errors', () => {

    fixture.componentRef.setInput(
      'downloadError',
      'No se pudo descargar el archivo.'
    );

    fixture.detectChanges();

    expandPanel();

    const alert: HTMLElement =
      fixture.nativeElement.querySelector('[role="alert"]');

    expect(alert.textContent)
      .toContain('No se pudo descargar el archivo.');

  });

});
