
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  provideRouter,
  Router
} from '@angular/router';

import { RouterTestingHarness } from
  '@angular/router/testing';

import { AnalysisComponent } from
  './analysis.component';


@Component({
  standalone: true,
  template: '<p>Contenido de análisis</p>'
})
class AnalysisPageStubComponent {}


describe('AnalysisComponent', () => {

  let harness: RouterTestingHarness;

  beforeEach(async () => {

    await TestBed.configureTestingModule({

      imports: [AnalysisComponent],

      providers: [

        provideRouter([{

          path: 'user/analysis',

          component: AnalysisComponent,

          children: [

            {
              path: 'results',
              component: AnalysisPageStubComponent
            },

            {
              path: 'evolution/compare',
              component: AnalysisPageStubComponent
            },

            {
              path: 'evolution',
              component: AnalysisPageStubComponent
            },

            {
              path: 'benchmark',
              component: AnalysisPageStubComponent
            },

            {
              path: '',
              redirectTo: 'results',
              pathMatch: 'full'
            }

          ]

        }])

      ]

    }).compileComponents();

    harness = await RouterTestingHarness.create();

  });


  function getLinks(): HTMLAnchorElement[] {

    return Array.from(
      harness.routeNativeElement!
        .querySelectorAll<HTMLAnchorElement>(
          '.analysis-navigation__link'
        )
    );

  }


  function getActiveLinks(): HTMLAnchorElement[] {

    return getLinks().filter(
      link => link.classList.contains('active')
    );

  }


  it('should create the analysis container', async () => {

    const component = await harness.navigateByUrl(
      '/user/analysis/results',
      AnalysisComponent
    );

    expect(component).toBeTruthy();

  });


  it('should render the three analysis sections in order', async () => {

    await harness.navigateByUrl('/user/analysis/results');

    expect(
      getLinks().map(
        link => link.textContent?.trim()
      )
    ).toEqual([
      'Resultados',
      'Evolución',
      'Benchmarking'
    ]);

    expect(
      getLinks().map(
        link => link.getAttribute('href')
      )
    ).toEqual([
      '/user/analysis/results',
      '/user/analysis/evolution',
      '/user/analysis/benchmark'
    ]);

  });


  it('should render child content through the router outlet', async () => {

    await harness.navigateByUrl('/user/analysis/results');

    expect(
      harness.routeNativeElement?.textContent
    ).toContain('Contenido de análisis');

  });


  it('should redirect the analysis root to results', async () => {

    await harness.navigateByUrl('/user/analysis');

    expect(TestBed.inject(Router).url)
      .toBe('/user/analysis/results');

  });


  const scenarios = [

    {
      path: '/user/analysis/results',
      label: 'Resultados',
      ariaCurrent: 'page'
    },

    {
      path: '/user/analysis/evolution',
      label: 'Evolución',
      ariaCurrent: 'location'
    },

    {
      path: '/user/analysis/benchmark',
      label: 'Benchmarking',
      ariaCurrent: 'page'
    },

    {
      path: '/user/analysis/evolution/compare'
        + '?evaluation_id_1=10&evaluation_id_2=20',
      label: 'Evolución',
      ariaCurrent: 'location'
    }

  ];


  for (const scenario of scenarios) {

    it(`should activate ${scenario.label} for ${scenario.path}`, async () => {

      await harness.navigateByUrl(scenario.path);

      await harness.fixture.whenStable();

      harness.detectChanges();

      const activeLinks = getActiveLinks();

      expect(activeLinks.length).toBe(1);

      expect(activeLinks[0]?.textContent?.trim())
        .toBe(scenario.label);

      expect(
        activeLinks[0]?.getAttribute('aria-current')
      ).toBe(scenario.ariaCurrent);

    });

  }


  it('should provide an accessible navigation landmark', async () => {

    await harness.navigateByUrl('/user/analysis/results');

    expect(
      harness.routeNativeElement?.querySelector(
        'nav[aria-label="Secciones de Análisis ASG"]'
      )
    ).not.toBeNull();

  });

});
