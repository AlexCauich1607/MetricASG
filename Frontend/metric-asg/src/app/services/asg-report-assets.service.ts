import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AsgReportAssetsService {

  async waitForAssets(
    reportElement: HTMLElement,
    timeoutMs = 10000
  ): Promise<void> {
    const ownerDocument = reportElement.ownerDocument;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        this.prepareAssets(
          reportElement,
          ownerDocument
        ),

        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                'Se agotó el tiempo de preparación de los recursos del reporte ASG.'
              )
            );
          }, timeoutMs);
        })
      ]);
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }
  }

  private async prepareAssets(
    reportElement: HTMLElement,
    ownerDocument: Document
  ): Promise<void> {
    const images = Array.from(
      reportElement.querySelectorAll<HTMLImageElement>('img')
    );

    await Promise.all([
      ownerDocument.fonts?.ready ?? Promise.resolve(),

      ...images.map(image => this.prepareImage(image))
    ]);
  }

  private async prepareImage(
    image: HTMLImageElement
  ): Promise<void> {
    try {
      await image.decode();

      if (!image.complete || image.naturalWidth === 0) {
        throw new Error('Imagen no disponible.');
      }
    } catch {
      throw new Error(
        `No se pudo cargar un recurso gráfico del reporte ASG: ${
          image.getAttribute('src') ?? 'Recurso desconocido'
        }`
      );
    }
  }
}