import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { EvaluationComponent } from './evaluation.component';
import { EvaluationService } from '../../../services/evaluation.service';
import { EvaluationStructure } from '../../../models/evaluation_structure';

describe('EvaluationComponent', () => {
  let component: EvaluationComponent;
  let fixture: ComponentFixture<EvaluationComponent>;

  const evaluationStructure: EvaluationStructure = {
    ambits: [
      {
        id: 1,
        name: 'Ambiental',
        color: '#00AA00',
        letter: 'A',
        indicators: [
          {
            id: 1,
            question: 'Pregunta de prueba',
            answers: [
              {
                id: 1,
                maturity_level_id: 1,
                text: 'Respuesta de prueba'
              }
            ]
          }
        ]
      }
    ]
  };

  const evaluationServiceMock = {
    getEvaluation: () => of(evaluationStructure)
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        EvaluationComponent
      ],
      providers: [
        {
          provide: EvaluationService,
          useValue: evaluationServiceMock
        },
        provideRouter([])
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(EvaluationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});