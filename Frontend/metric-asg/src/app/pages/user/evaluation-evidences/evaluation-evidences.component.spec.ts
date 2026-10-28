
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { EvaluationEvidencesComponent } from './evaluation-evidences.component';
import { EvidenceService } from '../../../services/evidence.service';
import { EvaluationEvidence } from '../../../models/evaluation_evidence';

describe('EvaluationEvidencesComponent', () => {
    let component: EvaluationEvidencesComponent;
    let fixture: ComponentFixture<EvaluationEvidencesComponent>;

    let getEvidencesSpy: jasmine.Spy;
    let createEvidenceSpy: jasmine.Spy;
    let deleteEvidenceSpy: jasmine.Spy;

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

        await TestBed.configureTestingModule({
            imports: [EvaluationEvidencesComponent],
            providers: [
                {
                    provide: EvidenceService,
                    useValue: {
                        getEvidences: getEvidencesSpy,
                        createEvidence: createEvidenceSpy,
                        deleteEvidence: deleteEvidenceSpy
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

    it('should not delete file evidence', () => {
        fixture.componentRef.setInput('canEdit', true);
        fixture.detectChanges();

        const fileEvidence: EvaluationEvidence = {
            ...mockEvidence,
            id: 2,
            type: 'FILE',
            content: null,
            original_filename: 'evidencia.pdf'
        };

        component.deleteEvidence(fileEvidence);

        expect(deleteEvidenceSpy).not.toHaveBeenCalled();
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

});
