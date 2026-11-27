import { TestBed } from '@angular/core/testing';
import { AsgReportAssetsService } from './asg-report-assets.service';

describe('AsgReportAssetsService', () => {
    let service: AsgReportAssetsService;
    let container: HTMLElement;

    beforeEach(() => {
        TestBed.configureTestingModule({});

        service = TestBed.inject(AsgReportAssetsService);

        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should prepare a report without images', async () => {
        await expectAsync(
            service.waitForAssets(container)
        ).toBeResolved();
    });

    it('should decode report images before resolving', async () => {
        const image = document.createElement('img');

        container.appendChild(image);

        const decodeSpy = spyOn(image, 'decode')
            .and.returnValue(Promise.resolve());

        spyOnProperty(image, 'complete', 'get')
            .and.returnValue(true);

        spyOnProperty(image, 'naturalWidth', 'get')
            .and.returnValue(100);

        await service.waitForAssets(container);

        expect(decodeSpy).toHaveBeenCalledTimes(1);
    });

    it('should reject an image that cannot be decoded', async () => {
        const image = document.createElement('img');

        spyOn(image, 'getAttribute')
            .withArgs('src')
            .and.returnValue('invalid-image.png');

        spyOn(image, 'decode')
            .and.returnValue(
                Promise.reject(new Error('Invalid image'))
            );

        container.appendChild(image);

        await expectAsync(
            service.waitForAssets(container)
        ).toBeRejectedWithError(
            'No se pudo cargar un recurso gráfico del reporte ASG: invalid-image.png'
        );
    });
    it('should reject an image without valid dimensions', async () => {
        const image = document.createElement('img');

        spyOn(image, 'decode')
            .and.returnValue(Promise.resolve());

        spyOnProperty(image, 'complete', 'get')
            .and.returnValue(true);

        spyOnProperty(image, 'naturalWidth', 'get')
            .and.returnValue(0);

        container.appendChild(image);

        await expectAsync(
            service.waitForAssets(container)
        ).toBeRejectedWithError(
            /No se pudo cargar un recurso gráfico/
        );
    });

    it('should reject when asset preparation exceeds the timeout', async () => {
        const image = document.createElement('img');

        spyOn(image, 'decode')
            .and.returnValue(
                new Promise<void>(() => { })
            );

        container.appendChild(image);

        await expectAsync(
            service.waitForAssets(container, 20)
        ).toBeRejectedWithError(
            'Se agotó el tiempo de preparación de los recursos del reporte ASG.'
        );
    });

    it('should not process images outside the report container', async () => {
        const externalImage = document.createElement('img');

        document.body.appendChild(externalImage);

        const decodeSpy = spyOn(externalImage, 'decode')
            .and.returnValue(Promise.resolve());

        try {
            await service.waitForAssets(container);

            expect(decodeSpy).not.toHaveBeenCalled();
        } finally {
            externalImage.remove();
        }
    });
    it('should wait until document fonts are ready', async () => {
        let resolveFonts!: (value: FontFaceSet) => void;

        const fontsReady = new Promise<FontFaceSet>(
            resolve => {
                resolveFonts = resolve;
            }
        );

        spyOnProperty(document.fonts, 'ready', 'get')
            .and.returnValue(fontsReady);

        let completed = false;

        const preparation = service
            .waitForAssets(container)
            .then(() => {
                completed = true;
            });

        await Promise.resolve();

        expect(completed).toBeFalse();

        resolveFonts(document.fonts);

        await preparation;

        expect(completed).toBeTrue();
    });
    it('should reject when document fonts are not ready before the timeout', async () => {
        spyOnProperty(document.fonts, 'ready', 'get')
            .and.returnValue(
                new Promise<FontFaceSet>(() => { })
            );

        await expectAsync(
            service.waitForAssets(container, 20)
        ).toBeRejectedWithError(
            'Se agotó el tiempo de preparación de los recursos del reporte ASG.'
        );
    });
});