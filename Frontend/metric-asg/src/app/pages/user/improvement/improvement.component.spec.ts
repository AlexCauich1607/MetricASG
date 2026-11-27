
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  provideRouter,
  Router
} from '@angular/router';

import { RouterTestingHarness } from
  '@angular/router/testing';

import { ImprovementComponent } from
  './improvement.component';


@Component({
  standalone: true,
  template: '<p>Contenido de mejora</p>'
})
class ImprovementPageStubComponent {}


describe('ImprovementComponent', () => {

  let harness: RouterTestingHarness;


  beforeEach(async () => {

    await TestBed.configureTestingModule({

      imports: [ImprovementComponent],

      providers: [

        provideRouter([{

          path: 'user/improvement',

          component: ImprovementComponent,

          children: [

            {
              path: 'recommendations',
              component: ImprovementPageStubComponent
            },

            {
              path: 'plan/:evaluationId',
              component: ImprovementPageStubComponent
            },

            {
              path: 'plan',
              component: ImprovementPageStubComponent
            },

            {
              path: '',
              redirectTo: 'recommendations',
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
          '.improvement-navigation__link'
        )
    );

  }


  function getActiveLinks(): HTMLAnchorElement[] {

    return getLinks().filter(
      link => link.classList.contains('active')
    );

  }


  it('should create the improvement container', async () => {

    const component = await harness.navigateByUrl(
      '/user/improvement/recommendations',
      ImprovementComponent
    );

    expect(component).toBeTruthy();

  });


  it('should render both improvement sections in order', async () => {

    await harness.navigateByUrl(
      '/user/improvement/recommendations'
    );

    expect(
      getLinks().map(
        link => link.textContent?.trim()
      )
    ).toEqual([
      'Recomendaciones',
      'Plan de mejora'
    ]);

    expect(
      getLinks().map(
        link => link.getAttribute('href')
      )
    ).toEqual([
      '/user/improvement/recommendations',
      '/user/improvement/plan'
    ]);

  });


  it('should render child content through the router outlet', async () => {

    await harness.navigateByUrl(
      '/user/improvement/recommendations'
    );

    expect(
      harness.routeNativeElement?.textContent
    ).toContain('Contenido de mejora');

  });


  it('should redirect the improvement root to recommendations', async () => {

    await harness.navigateByUrl('/user/improvement');

    expect(TestBed.inject(Router).url)
      .toBe('/user/improvement/recommendations');

  });


  const scenarios = [

    {
      path: '/user/improvement/recommendations',
      label: 'Recomendaciones',
      ariaCurrent: 'page'
    },

    {
      path: '/user/improvement/plan',
      label: 'Plan de mejora',
      ariaCurrent: 'location'
    },

    {
      path: '/user/improvement/plan/10',
      label: 'Plan de mejora',
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

    await harness.navigateByUrl(
      '/user/improvement/recommendations'
    );

    expect(
      harness.routeNativeElement?.querySelector(
        'nav[aria-label="Secciones de Mejora ASG"]'
      )
    ).not.toBeNull();

  });

});
