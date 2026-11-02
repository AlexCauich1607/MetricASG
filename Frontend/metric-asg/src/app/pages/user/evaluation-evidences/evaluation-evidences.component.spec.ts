
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { SimpleChange } from '@angular/core';
import { EvaluationEvidencesComponent } from './evaluation-evidences.component';
import { EvidenceService } from '../../../services/evidence.service';
import { EvaluationEvidence } from '../../../models/evaluation_evidence';

describe('EvaluationEvidencesComponent', () => {
    let component: EvaluationEvidencesComponent;
    let fixture: ComponentFixture<EvaluationEvidencesComponent>;

    let getEvidencesSpy: jasmine.Spy;
    let createEvidenceSpy: jasmine.Spy;
    let deleteEvidenceSpy: jasmine.Spy;
    let uploadEvidenceSpy: jasmine.Spy;
    let downloadEvidenceSpy: jasmine.Spy;

    const mockEvidence: EvaluationEvidence = {
        id: 1,
        evaluation_id: 10,
        indicator_id: 5,
        type: 'COMMENT',
        content: 'Evidencia ambiental',
        original_filename: null,
        mime_type: null,
        file_size: null,
        created_at: '2026-10-23T12:00:00',
        updated_at: '2026-10-23T12:00:00'
    };

    beforeEach(async () => {
        getEvidencesSpy = jasmine.createSpy('getEvidences')
            .and.returnValue(of([mockEvidence]));

        createEvidenceSpy = jasmine.createSpy('createEvidence')
            .and.returnValue(of(mockEvidence));

        deleteEvidenceSpy = jasmine.createSpy('deleteEvidence')
            .and.returnValue(of(void 0));

        uploadEvidenceSpy = jasmine.createSpy('uploadEvidence')
            .and.returnValue(of({
                ...mockEvidence,
                id: 2,
                type: 'FILE',
                content: null,
                original_filename: 'evidencia.pdf'
            }));

        downloadEvidenceSpy = jasmine.createSpy('downloadEvidence')
            .and.returnValue(
                of(new Blob(['PDF content'], {
                    type: 'application/pdf'
                }))
            );

        await TestBed.configureTestingModule({
            imports: [EvaluationEvidencesComponent],
            providers: [
                {
                    provide: EvidenceService,
                    useValue: {
                        getEvidences: getEvidencesSpy,
                        createEvidence: createEvidenceSpy,
                        deleteEvidence: deleteEvidenceSpy,
                        uploadEvidence: uploadEvidenceSpy,
                        downloadEvidence: downloadEvidenceSpy,
                    }
                }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(EvaluationEvidencesComponent);
        component = fixture.componentInstance;

        fixture.componentRef.setInput('evaluationId', 10);
        fixture.componentRef.setInput('indicatorId', 5);
        fixture.detectChanges();
    });

    it('should load evidences for the current indicator', () => {
        expect(getEvidencesSpy).toHaveBeenCalledWith(10, 5);
        expect(component.evidences()).toEqual([mockEvidence]);
        expect(component.loading()).toBeFalse();
    });

    it('should load evidences when the indicator changes', () => {
        getEvidencesSpy.calls.reset();

        fixture.componentRef.setInput('indicatorId', 6);
        fixture.detectChanges();

        expect(getEvidencesSpy).toHaveBeenCalledWith(10, 6);
    });

    it('should ignore responses from a previous indicator', () => {
        const previousRequest = new Subject<EvaluationEvidence[]>();
        const currentRequest = new Subject<EvaluationEvidence[]>();

        getEvidencesSpy.and.returnValues(
            previousRequest.asObservable(),
            currentRequest.asObservable()
        );

        fixture.componentRef.setInput('indicatorId', 6);
        fixture.detectChanges();

        fixture.componentRef.setInput('indicatorId', 7);
        fixture.detectChanges();

        currentRequest.next([]);
        currentRequest.complete();

        previousRequest.next([mockEvidence]);
        previousRequest.complete();

        expect(component.evidences()).toEqual([]);
        expect(component.loading()).toBeFalse();
    });

    it('should not load evidences without an evaluation ID', () => {
        getEvidencesSpy.calls.reset();

        fixture.componentRef.setInput('evaluationId', null);
        fixture.detectChanges();

        expect(getEvidencesSpy).not.toHaveBeenCalled();
        expect(component.evidences()).toEqual([]);
    });

    it('should create a comment evidence', () => {
        fixture.componentRef.setInput('canEdit', true);
        fixture.detectChanges();

        component.setEvidenceType('COMMENT');
        component.setEvidenceContent('Comentario de prueba');

        component.createEvidence();

        expect(createEvidenceSpy).toHaveBeenCalledWith(10, {
            indicator_id: 5,
            type: 'COMMENT',
            content: 'Comentario de prueba'
        });

        expect(component.evidences().length).toBe(2);
        expect(component.evidenceContent()).toBe('');
    });

    it('should create a URL evidence', () => {
        const urlEvidence: EvaluationEvidence = {
            ...mockEvidence,
            id: 2,
            type: 'URL',
            content: 'https://example.com/evidence'
        };

        createEvidenceSpy.and.returnValue(of(urlEvidence));

        fixture.componentRef.setInput('canEdit', true);
        fixture.detectChanges();

        component.setEvidenceType('URL');
        component.setEvidenceContent('https://example.com/evidence');

        component.createEvidence();

        expect(createEvidenceSpy).toHaveBeenCalledWith(10, {
            indicator_id: 5,
            type: 'URL',
            content: 'https://example.com/evidence'
        });

        expect(component.evidences().length).toBe(2);
        expect(component.evidences()[1]).toEqual(urlEvidence);
    });

    it('should reject an invalid HTTPS URL', () => {
        fixture.componentRef.setInput('canEdit', true);
        fixture.detectChanges();

        component.setEvidenceType('URL');
        component.setEvidenceContent('http://example.com');

        component.createEvidence();

        expect(createEvidenceSpy).not.toHaveBeenCalled();
        expect(component.saveError()).toBe(
            'Introduce un enlace HTTPS válido.'
        );
    });

    it('should not create evidence in read-only mode', () => {
        fixture.componentRef.setInput('readonly', true);
        fixture.componentRef.setInput('canEdit', true);
        fixture.detectChanges();

        component.setEvidenceContent('Comentario de prueba');
        component.createEvidence();

        expect(createEvidenceSpy).not.toHaveBeenCalled();
    });

    it('should delete an existing comment evidence', () => {
        fixture.componentRef.setInput('canEdit', true);
        fixture.detectChanges();

        spyOn(window, 'confirm').and.returnValue(true);

        component.deleteEvidence(mockEvidence);

        expect(deleteEvidenceSpy).toHaveBeenCalledWith(10, 1);
        expect(component.evidences()).toEqual([]);
        expect(component.deletingId()).toBeNull();
    });

    it('should not delete evidence when confirmation is cancelled', () => {
        fixture.componentRef.setInput('canEdit', true);
        fixture.detectChanges();

        spyOn(window, 'confirm').and.returnValue(false);

        component.deleteEvidence(mockEvidence);

        expect(deleteEvidenceSpy).not.toHaveBeenCalled();
        expect(component.evidences()).toEqual([mockEvidence]);
    });

    it('should not delete evidence in read-only mode', () => {
        fixture.componentRef.setInput('readonly', true);
        fixture.componentRef.setInput('canEdit', true);
        fixture.detectChanges();

        component.deleteEvidence(mockEvidence);

        expect(deleteEvidenceSpy).not.toHaveBeenCalled();
    });


    it('should delete file evidence', () => {
        const fileEvidence: EvaluationEvidence = {
            ...mockEvidence,
            id: 2,
            type: 'FILE',
            content: null,
            original_filename: 'evidencia.pdf'
        };

        component.evidences.set([fileEvidence]);
        component.canEdit = true;

        spyOn(window, 'confirm').and.returnValue(true);

        component.deleteEvidence(fileEvidence);

        expect(deleteEvidenceSpy).toHaveBeenCalledWith(10, 2);
        expect(component.evidences()).toEqual([]);
    });


    it('should not create evidence when the limit is reached', () => {
        fixture.componentRef.setInput('canEdit', true);
        fixture.detectChanges();

        component.evidences.set(
            Array.from({ length: 5 }, (_, index) => ({
                ...mockEvidence,
                id: index + 1
            }))
        );

        component.setEvidenceContent('Comentario adicional');
        component.createEvidence();

        expect(createEvidenceSpy).not.toHaveBeenCalled();
        expect(component.evidences().length).toBe(5);
        expect(component.canCreate).toBeFalse();
    });

    it('should preserve evidence list when creation fails', () => {
        fixture.componentRef.setInput('canEdit', true);
        fixture.detectChanges();

        createEvidenceSpy.and.returnValue(
            throwError(() => new HttpErrorResponse({
                status: 500
            }))
        );

        component.setEvidenceContent('Comentario de prueba');
        component.createEvidence();

        expect(component.evidences()).toEqual([mockEvidence]);
        expect(component.saving()).toBeFalse();
        expect(component.saveError()).toBe(
            'No se pudo guardar la evidencia. Inténtalo nuevamente.'
        );
    });

    it('should display a conflict message when creation is rejected', () => {
        fixture.componentRef.setInput('canEdit', true);
        fixture.detectChanges();

        createEvidenceSpy.and.returnValue(
            throwError(() => new HttpErrorResponse({
                status: 409
            }))
        );

        component.setEvidenceContent('Comentario de prueba');
        component.createEvidence();

        expect(component.saveError()).toBe(
            'No es posible agregar más evidencias o la evaluación ya está finalizada.'
        );

        expect(component.evidences()).toEqual([mockEvidence]);
    });

    it('should preserve evidence list when deletion fails', () => {
        fixture.componentRef.setInput('canEdit', true);
        fixture.detectChanges();

        spyOn(window, 'confirm').and.returnValue(true);

        deleteEvidenceSpy.and.returnValue(
            throwError(() => new HttpErrorResponse({
                status: 500
            }))
        );

        component.deleteEvidence(mockEvidence);

        expect(deleteEvidenceSpy).toHaveBeenCalledWith(10, 1);
        expect(component.evidences()).toEqual([mockEvidence]);
        expect(component.deletingId()).toBeNull();
        expect(component.deleteError()).toBe(
            'No se pudo eliminar la evidencia. Inténtalo nuevamente.'
        );
    });

    it('should ignore a pending creation after changing indicators', () => {
        const pendingCreation = new Subject<EvaluationEvidence>();

        createEvidenceSpy.and.returnValue(
            pendingCreation.asObservable()
        );

        fixture.componentRef.setInput('canEdit', true);
        fixture.detectChanges();

        component.setEvidenceContent('Comentario pendiente');
        component.createEvidence();

        expect(component.saving()).toBeTrue();

        fixture.componentRef.setInput('indicatorId', 6);
        fixture.detectChanges();

        fixture.componentRef.setInput('indicatorId', 5);
        fixture.detectChanges();

        pendingCreation.next(mockEvidence);
        pendingCreation.complete();

        expect(component.evidences()).toEqual([mockEvidence]);
        expect(component.saving()).toBeFalse();
        expect(component.evidenceContent()).toBe('');
    });

    it('should ignore a pending deletion after changing indicators', () => {
        const pendingDeletion = new Subject<void>();

        deleteEvidenceSpy.and.returnValue(
            pendingDeletion.asObservable()
        );

        spyOn(window, 'confirm').and.returnValue(true);

        fixture.componentRef.setInput('canEdit', true);
        fixture.detectChanges();

        component.deleteEvidence(mockEvidence);

        expect(component.deletingId()).toBe(1);

        fixture.componentRef.setInput('indicatorId', 6);
        fixture.detectChanges();

        fixture.componentRef.setInput('indicatorId', 5);
        fixture.detectChanges();

        pendingDeletion.next();
        pendingDeletion.complete();

        expect(component.evidences()).toEqual([mockEvidence]);
        expect(component.deletingId()).toBeNull();
    });


    it('should select a valid PDF file', () => {
        const file = new File(
            ['PDF content'],
            'evidencia.pdf',
            { type: 'application/pdf' }
        );

        const input = document.createElement('input');
        input.type = 'file';

        Object.defineProperty(input, 'files', {
            value: [file]
        });

        component.selectFile({
            target: input
        } as unknown as Event);

        expect(component.selectedFile()).toBe(file);
        expect(component.uploadError()).toBeNull();
    });

    it('should reject unsupported file types', () => {
        const file = new File(
            ['Text content'],
            'documento.txt',
            { type: 'text/plain' }
        );

        const input = document.createElement('input');
        input.type = 'file';

        Object.defineProperty(input, 'files', {
            value: [file]
        });

        component.selectFile({
            target: input
        } as unknown as Event);

        expect(component.selectedFile()).toBeNull();

        expect(component.uploadError()).toBe(
            'Solo se permiten archivos PDF, PNG y JPEG.'
        );
    });

    it('should reject files larger than 10 MB', () => {
        const file = new File(
            [new Uint8Array(10 * 1024 * 1024 + 1)],
            'archivo.pdf',
            { type: 'application/pdf' }
        );

        const input = document.createElement('input');
        input.type = 'file';

        Object.defineProperty(input, 'files', {
            value: [file]
        });

        component.selectFile({
            target: input
        } as unknown as Event);

        expect(component.selectedFile()).toBeNull();

        expect(component.uploadError()).toBe(
            'El archivo debe tener un tamaño mayor a 0 y no superar 10 MB.'
        );
    });

    it('should upload a selected file', () => {
        const file = new File(
            ['PDF content'],
            'evidencia.pdf',
            { type: 'application/pdf' }
        );

        component.canEdit = true;
        component.selectedFile.set(file);

        component.uploadEvidence();

        expect(uploadEvidenceSpy).toHaveBeenCalledWith(
            10,
            5,
            file
        );

        expect(component.uploading()).toBeFalse();
        expect(component.selectedFile()).toBeNull();
        expect(component.evidences().length).toBe(2);

        expect(component.evidences()[1].type).toBe('FILE');
    });

    it('should handle file upload validation errors', () => {
        const file = new File(
            ['Invalid PDF'],
            'evidencia.pdf',
            { type: 'application/pdf' }
        );

        uploadEvidenceSpy.and.returnValue(
            throwError(() => new HttpErrorResponse({
                status: 422
            }))
        );

        component.canEdit = true;
        component.selectedFile.set(file);

        component.uploadEvidence();

        expect(uploadEvidenceSpy).toHaveBeenCalledWith(
            10,
            5,
            file
        );

        expect(component.uploading()).toBeFalse();
        expect(component.selectedFile()).toBe(file);

        expect(component.uploadError()).toBe(
            'El archivo no cumple con las restricciones permitidas.'
        );

        expect(component.evidences()).toEqual([mockEvidence]);
    });

    it('should handle file upload conflicts', () => {
        const file = new File(
            ['PDF content'],
            'evidencia.pdf',
            { type: 'application/pdf' }
        );

        uploadEvidenceSpy.and.returnValue(
            throwError(() => new HttpErrorResponse({
                status: 409
            }))
        );

        component.canEdit = true;
        component.selectedFile.set(file);

        component.uploadEvidence();

        expect(component.uploading()).toBeFalse();

        expect(component.uploadError()).toBe(
            'No es posible agregar más evidencias o la evaluación ya está finalizada.'
        );

        expect(component.evidences()).toEqual([mockEvidence]);
    });

    it('should download file evidence', () => {
        const fileEvidence: EvaluationEvidence = {
            ...mockEvidence,
            id: 2,
            type: 'FILE',
            content: null,
            original_filename: 'evidencia.pdf'
        };

        const objectUrl = 'blob:mock-evidence';

        const createUrlSpy = spyOn(
            URL,
            'createObjectURL'
        ).and.returnValue(objectUrl);

        const revokeUrlSpy = spyOn(
            URL,
            'revokeObjectURL'
        );

        const clickSpy = spyOn(
            HTMLAnchorElement.prototype,
            'click'
        );

        jasmine.clock().install();

        try {
            component.downloadEvidence(fileEvidence);

            expect(downloadEvidenceSpy).toHaveBeenCalledWith(
                10,
                2
            );

            expect(createUrlSpy).toHaveBeenCalled();

            expect(clickSpy).toHaveBeenCalled();

            expect(component.downloadingId()).toBeNull();
            expect(component.downloadError()).toBeNull();

            jasmine.clock().tick(1000);

            expect(revokeUrlSpy).toHaveBeenCalledWith(
                objectUrl
            );
        } finally {
            jasmine.clock().uninstall();
        }
    });

    it('should handle file download errors', () => {
        const fileEvidence: EvaluationEvidence = {
            ...mockEvidence,
            id: 2,
            type: 'FILE',
            content: null,
            original_filename: 'evidencia.pdf'
        };

        downloadEvidenceSpy.and.returnValue(
            throwError(() => new HttpErrorResponse({
                status: 404
            }))
        );

        component.downloadEvidence(fileEvidence);

        expect(downloadEvidenceSpy).toHaveBeenCalledWith(
            10,
            2
        );

        expect(component.downloadingId()).toBeNull();

        expect(component.downloadError()).toBe(
            'No se pudo descargar el archivo. Inténtalo nuevamente.'
        );
    });


    it('should ignore file upload response after indicator changes', () => {
        const pendingUpload = new Subject<EvaluationEvidence>();

        uploadEvidenceSpy.and.returnValue(
            pendingUpload.asObservable()
        );

        // El indicador 6 no tiene evidencias registradas.
        getEvidencesSpy.and.returnValue(of([]));

        const file = new File(
            ['PDF content'],
            'evidencia.pdf',
            { type: 'application/pdf' }
        );

        component.canEdit = true;
        component.selectedFile.set(file);

        component.uploadEvidence();

        expect(component.uploading()).toBeTrue();

        component.indicatorId = 6;

        component.ngOnChanges({
            indicatorId: new SimpleChange(5, 6, false)
        });

        expect(getEvidencesSpy).toHaveBeenCalledWith(10, 6);
        expect(component.uploading()).toBeFalse();
        expect(component.evidences()).toEqual([]);

        pendingUpload.next({
            ...mockEvidence,
            id: 2,
            indicator_id: 5,
            type: 'FILE',
            content: null,
            original_filename: 'evidencia.pdf'
        });

        pendingUpload.complete();

        expect(component.evidences()).toEqual([]);
        expect(component.selectedFile()).toBeNull();
        expect(component.uploading()).toBeFalse();
    });


    it('should track pending state during file upload', () => {
        const pendingUpload = new Subject<EvaluationEvidence>();

        uploadEvidenceSpy.and.returnValue(
            pendingUpload.asObservable()
        );

        const pendingSpy = spyOn(
            component.operationPending,
            'emit'
        );

        const file = new File(
            ['PDF content'],
            'evidencia.pdf',
            { type: 'application/pdf' }
        );

        component.canEdit = true;
        component.selectedFile.set(file);

        component.uploadEvidence();

        expect(component.uploading()).toBeTrue();
        expect(pendingSpy).toHaveBeenCalledWith(true);

        pendingUpload.next({
            ...mockEvidence,
            id: 2,
            type: 'FILE',
            content: null,
            original_filename: 'evidencia.pdf'
        });

        pendingUpload.complete();

        expect(component.uploading()).toBeFalse();
        expect(pendingSpy).toHaveBeenCalledWith(false);
    });

    it('should keep evidence section collapsed initially', () => {
        expect(component.isExpanded()).toBeFalse();
    });

    it('should not expand evidence section without an answer', () => {
        component.hasAnswer = false;
        component.canEdit = false;

        component.toggleExpanded();

        expect(component.isExpanded()).toBeFalse();
    });

    it('should expand and collapse evidence section when editing is allowed', () => {
        component.hasAnswer = true;
        component.canEdit = true;

        component.toggleExpanded();

        expect(component.isExpanded()).toBeTrue();

        component.toggleExpanded();

        expect(component.isExpanded()).toBeFalse();
    });

    it('should not expand evidence section during an upload', () => {
        component.hasAnswer = true;
        component.canEdit = true;
        component.uploading.set(true);

        component.toggleExpanded();

        expect(component.isExpanded()).toBeFalse();
    });

});
