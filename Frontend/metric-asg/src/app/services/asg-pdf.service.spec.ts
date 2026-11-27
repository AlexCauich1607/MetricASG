import { TestBed } from '@angular/core/testing';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

import {
  AsgPdfService,
  ASG_PDF_CAPTURE,
  ASG_PDF_DOCUMENT_FACTORY
} from './asg-pdf.service';

describe('AsgPdfService', () => {

  let service: AsgPdfService;

  let captureSpy: jasmine.Spy<typeof html2canvas>;

  let documentFactorySpy: jasmine.Spy<() => jsPDF>;

  let pdfMock: {
    internal: {
      pageSize: {
        getWidth: jasmine.Spy;
        getHeight: jasmine.Spy;
      };
    };
    addPage: jasmine.Spy;
    addImage: jasmine.Spy;
    save: jasmine.Spy;
  };

  let canvas: HTMLCanvasElement;

  let pages: HTMLElement[];

  const imageData =
    'data:image/png;base64,TEST_IMAGE';

  beforeEach(() => {

    pages = [
      document.createElement('div'),
      document.createElement('div'),
      document.createElement('div')
    ];

    canvas = document.createElement('canvas');

    spyOn(canvas, 'toDataURL')
      .and.returnValue(imageData);

    pdfMock = {
      internal: {
        pageSize: {
          getWidth: jasmine.createSpy('getWidth')
            .and.returnValue(210),

          getHeight: jasmine.createSpy('getHeight')
            .and.returnValue(297)
        }
      },

      addPage: jasmine.createSpy('addPage'),

      addImage: jasmine.createSpy('addImage'),

      save: jasmine.createSpy('save')
    };

    captureSpy = jasmine
      .createSpy<typeof html2canvas>('capture')
      .and.resolveTo(canvas);

    documentFactorySpy = jasmine
      .createSpy<() => jsPDF>('createDocument')
      .and.returnValue(pdfMock as unknown as jsPDF);

    TestBed.configureTestingModule({
      providers: [
        AsgPdfService,
        {
          provide: ASG_PDF_CAPTURE,
          useValue: captureSpy
        },
        {
          provide: ASG_PDF_DOCUMENT_FACTORY,
          useValue: documentFactorySpy
        }
      ]
    });

    service = TestBed.inject(AsgPdfService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should reject a report without pages', async () => {

    await expectAsync(
      service.generatePdf([], 'reporte.pdf')
    ).toBeRejectedWithError(
      'El reporte no contiene páginas para exportar.'
    );

    expect(captureSpy).not.toHaveBeenCalled();

    expect(documentFactorySpy)
      .not.toHaveBeenCalled();

    expect(pdfMock.save).not.toHaveBeenCalled();
  });

  it('should generate and save a single-page PDF', async () => {

    await service.generatePdf(
      [pages[0]],
      'reporte-asg-1.pdf'
    );

    expect(documentFactorySpy)
      .toHaveBeenCalledTimes(1);

    expect(captureSpy).toHaveBeenCalledOnceWith(
      pages[0],
      {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      }
    );

    expect(canvas.toDataURL)
      .toHaveBeenCalledOnceWith('image/png');

    expect(pdfMock.addImage).toHaveBeenCalledOnceWith(
      imageData,
      'PNG',
      0,
      0,
      210,
      297,
      undefined,
      'FAST'
    );

    expect(pdfMock.addPage).not.toHaveBeenCalled();

    expect(pdfMock.save).toHaveBeenCalledOnceWith(
      'reporte-asg-1.pdf'
    );
  });

  it('should generate all pages in the original order', async () => {

    await service.generatePdf(
      pages,
      'reporte-multiple.pdf'
    );

    expect(captureSpy).toHaveBeenCalledTimes(3);

    expect(
      captureSpy.calls.allArgs().map(args => args[0])
    ).toEqual(pages);

    expect(pdfMock.addPage)
      .toHaveBeenCalledTimes(2);

    expect(pdfMock.addImage)
      .toHaveBeenCalledTimes(3);

    expect(pdfMock.save)
      .toHaveBeenCalledOnceWith(
        'reporte-multiple.pdf'
      );
  });

  it('should not create a PDF when already cancelled', async () => {

    await service.generatePdf(
      pages,
      'reporte.pdf',
      () => false
    );

    expect(documentFactorySpy)
      .not.toHaveBeenCalled();

    expect(captureSpy).not.toHaveBeenCalled();

    expect(pdfMock.addImage)
      .not.toHaveBeenCalled();

    expect(pdfMock.save)
      .not.toHaveBeenCalled();
  });

  it('should cancel PDF generation during an asynchronous page capture', async () => {

    let active = true;

    let resolveCapture!: (
      value: HTMLCanvasElement
    ) => void;

    const pendingCapture =
      new Promise<HTMLCanvasElement>(resolve => {
        resolveCapture = resolve;
      });

    captureSpy.and.returnValue(pendingCapture);

    const generation = service.generatePdf(
      pages,
      'reporte.pdf',
      () => active
    );

    expect(captureSpy)
      .toHaveBeenCalledTimes(1);

    // Invalidar mientras la captura está pendiente.
    active = false;

    resolveCapture(canvas);

    await generation;

    expect(captureSpy)
      .toHaveBeenCalledTimes(1);

    expect(canvas.toDataURL)
      .not.toHaveBeenCalled();

    expect(pdfMock.addImage)
      .not.toHaveBeenCalled();

    expect(pdfMock.addPage)
      .not.toHaveBeenCalled();

    expect(pdfMock.save)
      .not.toHaveBeenCalled();
  });

  it('should stop capturing remaining pages after cancellation', async () => {

    let active = true;

    pdfMock.addImage.and.callFake(() => {
      active = false;
    });

    await service.generatePdf(
      pages,
      'reporte.pdf',
      () => active
    );

    expect(captureSpy)
      .toHaveBeenCalledTimes(1);

    expect(pdfMock.addImage)
      .toHaveBeenCalledTimes(1);

    expect(pdfMock.addPage)
      .not.toHaveBeenCalled();

    expect(pdfMock.save)
      .not.toHaveBeenCalled();
  });

  it('should not save a PDF invalidated after its last page', async () => {

    let active = true;

    pdfMock.addImage.and.callFake(() => {
      active = false;
    });

    await service.generatePdf(
      [pages[0]],
      'reporte.pdf',
      () => active
    );

    expect(captureSpy)
      .toHaveBeenCalledTimes(1);

    expect(pdfMock.addImage)
      .toHaveBeenCalledTimes(1);

    expect(pdfMock.save)
      .not.toHaveBeenCalled();
  });

  it('should propagate capture errors without saving the PDF', async () => {

    captureSpy.and.rejectWith(
      new Error('Error durante la captura')
    );

    await expectAsync(
      service.generatePdf(
        pages,
        'reporte.pdf'
      )
    ).toBeRejectedWithError(
      'Error durante la captura'
    );

    expect(captureSpy)
      .toHaveBeenCalledTimes(1);

    expect(pdfMock.addImage)
      .not.toHaveBeenCalled();

    expect(pdfMock.save)
      .not.toHaveBeenCalled();
  });

  it('should propagate image insertion errors without saving the PDF', async () => {

    pdfMock.addImage.and.throwError(
      'Error al insertar la imagen'
    );

    await expectAsync(
      service.generatePdf(
        pages,
        'reporte.pdf'
      )
    ).toBeRejectedWithError(
      'Error al insertar la imagen'
    );

    expect(captureSpy)
      .toHaveBeenCalledTimes(1);

    expect(pdfMock.save)
      .not.toHaveBeenCalled();
  });

});