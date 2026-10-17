import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ResultsComponent } from './results.component';
import { EvaluationService } from '../../../services/evaluation.service';
import { ResultEvaluation } from '../../../models/evaluation_result';

describe('ResultsComponent', () => {
  let component: ResultsComponent;
  let fixture: ComponentFixture<ResultsComponent>;
  let evaluationServiceSpy: jasmine.SpyObj<EvaluationService>;

  const mockResults: ResultEvaluation = {
    evaluation_id: 1,
    date: '2026-09-15T12:00:00',
    global_score: 8.5,
    global_maturity_level: 'Intermedio',
    ambits: [
      {
        ambit_id: 1,
        ambit_name: 'Ambiental',
        score: 9.5,
        letter: 'A',
        color: '#00AA00',
        maturity_level: 'Avanzado',
        maturity_color: '#15b91d',
        feedback: 'Buen desempeño ambiental'
      },
      {
        ambit_id: 2,
        ambit_name: 'Social',
        score: 7.5,
        letter: 'S',
        color: '#0000AA',
        maturity_level: 'Intermedio',
        maturity_color: '#eac84f',
        feedback: 'Se recomienda mejorar'
      }
    ]
  };

  beforeEach(async () => {
    evaluationServiceSpy = jasmine.createSpyObj(
      'EvaluationService',
      ['getLastEvaluationResult']
    );

    await TestBed.configureTestingModule({
      imports: [
        ResultsComponent
      ],
      providers: [
        {
          provide: EvaluationService,
          useValue: evaluationServiceSpy
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ResultsComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load the last evaluation result', () => {
    evaluationServiceSpy.getLastEvaluationResult.and.returnValue(
      of(mockResults)
    );

    component.loadResults();

    expect(
      evaluationServiceSpy.getLastEvaluationResult
    ).toHaveBeenCalledWith(component.id_user);

    expect(component.results).toEqual(mockResults);
  });

  it('should build chart data when results are loaded', () => {
    evaluationServiceSpy.getLastEvaluationResult.and.returnValue(
      of(mockResults)
    );

    component.loadResults();

    expect(component.ambits).toEqual([
      'Ambiental',
      'Social'
    ]);

    expect(component.scores).toEqual([
      9.5,
      7.5
    ]);

    expect(component.colors).toEqual([
      '#00AA00',
      '#0000AA'
    ]);

    expect(component.bordes).toEqual([
      '#15b91d',
      '#eac84f'
    ]);

    expect(component.loadingChart).toBeTrue();
  });

  it('should calculate the current and previous evaluation periods', () => {
    component.getPeriodo('2026-09-15T12:00:00');

    expect(component.mesActual).toBe('Septiembre');
    expect(component.anioActual).toBe('2026');

    expect(component.mesAnterior).toBe('Marzo');
    expect(component.anioAnterior).toBe('2026');
  });

  it('should capitalize the first letter of a text', () => {
    expect(component.capitalizar('septiembre')).toBe('Septiembre');
  });

  it('should return the same value when capitalizing an empty text', () => {
    expect(component.capitalizar('')).toBe('');
  });

  it('should return the correct border color for each maturity level', () => {
    expect(component.getBorderColor('Básico')).toBe('#ce4040ff');
    expect(component.getBorderColor('Intermedio')).toBe('#eac84fff');
    expect(component.getBorderColor('Avanzado')).toBe('#15b91dff');
  });
});