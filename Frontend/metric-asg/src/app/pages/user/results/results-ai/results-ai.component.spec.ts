
import {
  ComponentFixture,
  TestBed
} from '@angular/core/testing';

import { ResultsAiComponent } from './results-ai.component';

describe('ResultsAiComponent', () => {

  let component: ResultsAiComponent;
  let fixture: ComponentFixture<ResultsAiComponent>;

  beforeEach(async () => {

    await TestBed.configureTestingModule({
      imports: [ResultsAiComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ResultsAiComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();

  });

  it('should create', () => {

    expect(component).toBeTruthy();

  });

  it('should not request an explanation automatically', () => {

    const generateSpy = spyOn(component.generate, 'emit');

    fixture.detectChanges();

    expect(generateSpy).not.toHaveBeenCalled();

  });

  it('should emit generate when the user requests an explanation', () => {

    const generateSpy = spyOn(component.generate, 'emit');

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('button');

    button.click();

    expect(generateSpy).toHaveBeenCalledTimes(1);

  });

  it('should prevent repeated requests while generating', () => {

    const generateSpy = spyOn(component.generate, 'emit');

    fixture.componentRef.setInput('generating', true);
    fixture.detectChanges();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('button');

    expect(button.disabled).toBeTrue();

    component.requestExplanation();

    expect(generateSpy).not.toHaveBeenCalled();

  });

  it('should display the generated explanation', () => {

    fixture.componentRef.setInput(
      'explanation',
      'Interpretación de prueba ASG.'
    );

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent)
      .toContain('Interpretación de prueba ASG.');

    expect(fixture.nativeElement.textContent)
      .toContain('Generar nuevamente');

  });

  it('should display an error and allow retrying', () => {

    fixture.componentRef.setInput(
      'error',
      'No fue posible generar la explicación.'
    );

    fixture.detectChanges();

    const alert: HTMLElement =
      fixture.nativeElement.querySelector('[role="alert"]');

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('button');

    expect(alert.textContent)
      .toContain('No fue posible generar la explicación.');

    expect(button.textContent)
      .toContain('Reintentar');

    expect(button.disabled).toBeFalse();

  });

  it('should render a single loading panel outside the action button', () => {

    fixture.componentRef.setInput('generating', true);

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    const loadingPanels = element.querySelectorAll(
      '.results-ai__loading'
    );

    const button = element.querySelector(
      '.results-ai__actions button'
    ) as HTMLButtonElement;

    expect(loadingPanels.length).toBe(1);

    expect(
      button.querySelector('.results-ai__loading')
    ).toBeNull();

    expect(button.disabled).toBeTrue();

    expect(button.textContent).toContain(
      'Generando explicación...'
    );

    expect(button.textContent).not.toContain(
      'Analizando tus resultados...'
    );

  });


  it('should identify known explanation headings', () => {

    fixture.componentRef.setInput(
      'explanation',
      [
        'Resumen general del resultado ASG',
        '',
        'La puntuación global es de 9.47 puntos.',
        '',
        'Interpretación de los resultados por ámbito',
        '',
        'El ámbito Ambiental obtuvo 9.80 puntos.',
        '',
        'Brechas registradas',
        '',
        'No se registran brechas.'
      ].join('\n')
    );

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    const headings = Array.from(
      element.querySelectorAll(
        '.results-ai__section-title'
      )
    ).map(heading => heading.textContent?.trim());

    expect(headings).toEqual([
      'Resumen general del resultado ASG',
      'Interpretación de los resultados por ámbito',
      'Brechas registradas'
    ]);

  });

  it('should render explanation paragraphs separately', () => {

    fixture.componentRef.setInput(
      'explanation',
      'Resumen general del resultado ASG\r\n\r\n' +
      'Primer párrafo de la explicación.\r\n\r\n' +
      'Segundo párrafo de la explicación.'
    );

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    const paragraphs = Array.from(
      element.querySelectorAll(
        '.results-ai__paragraph'
      )
    ).map(paragraph => paragraph.textContent?.trim());

    expect(paragraphs).toEqual([
      'Primer párrafo de la explicación.',
      'Segundo párrafo de la explicación.'
    ]);

  });

  it('should preserve unrecognized explanation content', () => {

    fixture.componentRef.setInput(
      'explanation',
      'Información adicional\n\n' +
      'La puntuación oficial es de 9.47 puntos.'
    );

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(
      element.querySelectorAll('.results-ai__section-title').length
    ).toBe(0);

    expect(element.textContent).toContain(
      'Información adicional'
    );

    expect(element.textContent).toContain(
      'La puntuación oficial es de 9.47 puntos.'
    );

  });

  it('should render potentially unsafe HTML as plain text', () => {

    const unsafeContent =
      '<img src="invalid" onerror="alert(1)">';

    fixture.componentRef.setInput(
      'explanation',
      unsafeContent
    );

    fixture.detectChanges();

    const content: HTMLElement =
      fixture.nativeElement.querySelector(
        '.results-ai__explanation'
      );

    expect(content.querySelector('img')).toBeNull();

    expect(content.textContent).toContain(
      unsafeContent
    );

  });

  it('should update formatted content when explanation changes', () => {

    fixture.componentRef.setInput(
      'explanation',
      'Resumen ejecutivo\n\nPrimera interpretación.'
    );

    fixture.detectChanges();

    fixture.componentRef.setInput(
      'explanation',
      'Conclusión\n\nSegunda interpretación.'
    );

    fixture.detectChanges();

    const content: HTMLElement =
      fixture.nativeElement.querySelector(
        '.results-ai__explanation'
      );

    expect(content.textContent).toContain(
      'Segunda interpretación.'
    );

    expect(content.textContent).not.toContain(
      'Primera interpretación.'
    );

  });

  it('should identify known explanation headings', () => {

    fixture.componentRef.setInput(
      'explanation',
      [
        'Resumen general del resultado ASG',
        '',
        'La puntuación global es de 9.47 puntos.',
        '',
        'Interpretación de los resultados por ámbito',
        '',
        'El ámbito Ambiental obtuvo 9.80 puntos.',
        '',
        'Brechas registradas',
        '',
        'No se registran brechas.'
      ].join('\n')
    );

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    const headings = Array.from(
      element.querySelectorAll(
        '.results-ai__section-title'
      )
    ).map(heading => heading.textContent?.trim());

    expect(headings).toEqual([
      'Resumen general del resultado ASG',
      'Interpretación de los resultados por ámbito',
      'Brechas registradas'
    ]);

  });

  it('should render explanation paragraphs separately', () => {

    fixture.componentRef.setInput(
      'explanation',
      'Resumen general del resultado ASG\r\n\r\n' +
      'Primer párrafo de la explicación.\r\n\r\n' +
      'Segundo párrafo de la explicación.'
    );

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    const paragraphs = Array.from(
      element.querySelectorAll(
        '.results-ai__paragraph'
      )
    ).map(paragraph => paragraph.textContent?.trim());

    expect(paragraphs).toEqual([
      'Primer párrafo de la explicación.',
      'Segundo párrafo de la explicación.'
    ]);

  });

  it('should preserve unrecognized explanation content', () => {

    fixture.componentRef.setInput(
      'explanation',
      'Información adicional\n\n' +
      'La puntuación oficial es de 9.47 puntos.'
    );

    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;

    expect(
      element.querySelectorAll('.results-ai__section-title').length
    ).toBe(0);

    expect(element.textContent).toContain(
      'Información adicional'
    );

    expect(element.textContent).toContain(
      'La puntuación oficial es de 9.47 puntos.'
    );

  });

  it('should render potentially unsafe HTML as plain text', () => {

    const unsafeContent =
      '<img src="invalid" onerror="alert(1)">';

    fixture.componentRef.setInput(
      'explanation',
      unsafeContent
    );

    fixture.detectChanges();

    const content: HTMLElement =
      fixture.nativeElement.querySelector(
        '.results-ai__explanation'
      );

    expect(content.querySelector('img')).toBeNull();

    expect(content.textContent).toContain(
      unsafeContent
    );

  });

  it('should update formatted content when explanation changes', () => {

    fixture.componentRef.setInput(
      'explanation',
      'Resumen ejecutivo\n\nPrimera interpretación.'
    );

    fixture.detectChanges();

    fixture.componentRef.setInput(
      'explanation',
      'Conclusión\n\nSegunda interpretación.'
    );

    fixture.detectChanges();

    const content: HTMLElement =
      fixture.nativeElement.querySelector(
        '.results-ai__explanation'
      );

    expect(content.textContent).toContain(
      'Segunda interpretación.'
    );

    expect(content.textContent).not.toContain(
      'Primera interpretación.'
    );

  });

});
