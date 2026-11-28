
import {
  ComponentFixture,
  TestBed
} from '@angular/core/testing';

import {
  provideHttpClient,
  withXhr
} from '@angular/common/http';

import { FeedbackComponent } from './feedback.component';
import { ResultAmbit } from '../../models/evaluation_result';

describe('FeedbackComponent', () => {

  let component: FeedbackComponent;
  let fixture: ComponentFixture<FeedbackComponent>;

  const mockAmbits = [
    {
      ambit_id: 1,
      ambit_name: 'Ambiental',
      letter: 'A',
      score: 9.8,
      color: '#5d9732',
      maturity_color: '#15b91dff',
      maturity_level: 'Avanzado',
      feedback: 'Fortalecer las políticas ambientales.'
    },
    {
      ambit_id: 2,
      ambit_name: 'Social',
      letter: 'S',
      score: 9.6,
      color: '#1565c0',
      maturity_color: '#15b91dff',
      maturity_level: 'Avanzado',
      feedback: 'Mantener las prácticas de bienestar laboral.'
    },
    {
      ambit_id: 3,
      ambit_name: 'Gobernanza',
      letter: 'G',
      score: 9.0,
      color: '#6945ac',
      maturity_color: '#eac84fff',
      maturity_level: 'Intermedio',
      feedback: 'Mejorar los mecanismos de transparencia.'
    }
  ] as ResultAmbit[];

  beforeEach(async () => {

    await TestBed.configureTestingModule({
      imports: [
        FeedbackComponent
      ],
      providers: [
        provideHttpClient(withXhr())
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FeedbackComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();

  });

  it('should create', () => {

    expect(component).toBeTruthy();

  });

  it('should preserve the default variant initially', () => {

    expect(component.variant).toBe('default');

  });

  it('should render one analysis card for each ambit', () => {

    component.variant = 'analysis';
    component.ambits = mockAmbits;

    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll(
      '.analysis-feedback__card'
    );

    expect(cards.length).toBe(3);

  });

  it('should preserve the original recommendation content', () => {

    component.variant = 'analysis';
    component.ambits = mockAmbits;

    fixture.detectChanges();

    const content: string =
      fixture.nativeElement.textContent;

    mockAmbits.forEach(ambit => {

      expect(content).toContain(ambit.feedback);

    });

  });

  it('should display ambit scores and maturity levels', () => {

    component.variant = 'analysis';
    component.ambits = mockAmbits;

    fixture.detectChanges();

    const cards: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll(
        '.analysis-feedback__card'
      );

    expect(cards.length).toBe(mockAmbits.length);

    cards.forEach((card, index) => {

      const ambit = mockAmbits[index];

      expect(card.textContent)
        .toContain(ambit.score.toFixed(1));

      expect(card.textContent)
        .toContain(ambit.maturity_level);

    });

  });

  it('should preserve dynamic ambit and maturity colors', () => {

    component.variant = 'analysis';
    component.ambits = mockAmbits;

    fixture.detectChanges();

    const cards: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll(
        '.analysis-feedback__card'
      );

    expect(cards.length).toBe(mockAmbits.length);

    cards.forEach((card, index) => {

      expect(
        card.style
          .getPropertyValue('--feedback-accent')
          .trim()
      ).toBe(mockAmbits[index].color);

      expect(
        card.style
          .getPropertyValue('--feedback-maturity')
          .trim()
      ).toBe(mockAmbits[index].maturity_color);

    });

  });

  it('should render the legacy recommendations by default', () => {

    component.variant = 'default';
    component.ambits = mockAmbits;

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '.analysis-feedback'
      )
    ).toBeNull();

    expect(fixture.nativeElement.textContent)
      .toContain(mockAmbits[0].feedback);

  });

  it('should display a fallback when feedback is empty', () => {

    component.variant = 'analysis';

    component.ambits = [
      {
        ...mockAmbits[0],
        feedback: ''
      }
    ];

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent)
      .toContain(
        'No hay recomendaciones disponibles para este ámbito.'
      );

  });

  it('should handle an empty ambit collection', () => {

    component.variant = 'analysis';
    component.ambits = [];

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll(
        '.analysis-feedback__card'
      ).length
    ).toBe(0);

  });

  it('should return the appropriate ambit icons', () => {

    expect(component.getAmbitIcon('A'))
      .toBe('bi bi-tree');

    expect(component.getAmbitIcon('S'))
      .toBe('bi bi-people');

    expect(component.getAmbitIcon('G'))
      .toBe('bi bi-bank');

    expect(component.getAmbitIcon('X'))
      .toBe('bi bi-globe-americas');

  });

});
