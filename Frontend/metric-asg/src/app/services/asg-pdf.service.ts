import {
  Injectable,
  InjectionToken,
  inject
} from '@angular/core';

import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export const ASG_PDF_CAPTURE =
  new InjectionToken<typeof html2canvas>(
    'ASG_PDF_CAPTURE',
    {
      providedIn: 'root',
      factory: () => html2canvas
    }
  );

export const ASG_PDF_DOCUMENT_FACTORY =
  new InjectionToken<() => jsPDF>(
    'ASG_PDF_DOCUMENT_FACTORY',
    {
      providedIn: 'root',
      factory: () => () => new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      })
    }
  );

@Injectable({
  providedIn: 'root'
})
export class AsgPdfService {

  private readonly capture =
    inject(ASG_PDF_CAPTURE);

  private readonly createDocument =
    inject(ASG_PDF_DOCUMENT_FACTORY);

  async generatePdf(
    pages: HTMLElement[],
    filename: string,
    shouldContinue: () => boolean = () => true
  ): Promise<void> {

    if (!shouldContinue()) {
      return;
    }

    if (pages.length === 0) {
      throw new Error(
        'El reporte no contiene páginas para exportar.'
      );
    }

    const pdf = this.createDocument();

    const pageWidth =
      pdf.internal.pageSize.getWidth();

    const pageHeight =
      pdf.internal.pageSize.getHeight();

    for (const [index, page] of pages.entries()) {

      if (!shouldContinue()) {
        return;
      }

      const canvas = await this.capture(page, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true
      });

      if (!shouldContinue()) {
        return;
      }

      if (index > 0) {
        pdf.addPage();
      }

      pdf.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        0,
        pageWidth,
        pageHeight,
        undefined,
        'FAST'
      );
    }

    if (!shouldContinue()) {
      return;
    }

    pdf.save(filename);
  }
}