
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import {
  provideRouter,
  Router,
  Route,
  Routes,
  RouterOutlet
} from '@angular/router';

import { RouterTestingHarness } from
  '@angular/router/testing';

import { pagesRoutes } from './pages.routes';

import { authGuard } from
  '../core/guards/auth.guard';

import { userGuard } from
  '../core/guards/user.guard';

import { companySelectedGuard } from
  '../core/guards/company-selected.guard';

import { companyAdminGuard } from
  '../core/guards/company-admin.guard';

import { evaluationExitGuard } from
  '../core/guards/evaluation-exit.guard';


@Component({
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet></router-outlet>'
})
class RouteContainerStubComponent {}


@Component({
  standalone: true,
  template: '<p>Contenido de prueba</p>'
})
class RoutePageStubComponent {}


describe('MetricASG user routes', () => {

  let harness: RouterTestingHarness;

  const userRoute = pagesRoutes.find(
    route => route.path === 'user'
  )!;

  const userChildren = userRoute.children!;

  const analysisRoute = userChildren.find(
    route => route.path === 'analysis'
  )!;

  const improvementRoute = userChildren.find(
    route => route.path === 'improvement'
  )!;


  /**
   * Conserva la estructura y las redirecciones reales.
   *
   * Sustituye los componentes y desactiva los guards
   * exclusivamente para aislar las pruebas de navegación.
   *
   * La configuración original no se modifica.
   */
  function createTestRoute(route: Route): Route {

    const {
      loadComponent,
      component,
      children,
      canActivate,
      canActivateChild,
      canDeactivate,
      canMatch,
      ...configuration
    } = route;

    if (route.redirectTo !== undefined) {
      return configuration;
    }

    if (children) {

      return {
        ...configuration,

        component: RouteContainerStubComponent,

        children: children.map(createTestRoute)
      };

    }

    return {
      ...configuration,
      component: RoutePageStubComponent
    };

  }


  beforeEach(async () => {

    const testRoutes: Routes = [
      createTestRoute(userRoute)
    ];

    await TestBed.configureTestingModule({

      providers: [
        provideRouter(testRoutes)
      ]

    }).compileComponents();

    harness = await RouterTestingHarness.create();

  });


  // Redirecciones de compatibilidad.

  const legacyRoutes = [

    {
      previous: '/user/results',
      expected: '/user/analysis/results'
    },

    {
      previous: '/user/history',
      expected: '/user/analysis/evolution'
    },

    {
      previous: '/user/compare',
      expected: '/user/analysis/evolution/compare'
    },

    {
      previous: '/user/benchmark',
      expected: '/user/analysis/benchmark'
    },

    {
      previous: '/user/feedback',
      expected: '/user/improvement/recommendations'
    },

    {
      previous: '/user/evaluations/10/improvement-plan',
      expected: '/user/improvement/plan/10'
    }

  ];


  for (const scenario of legacyRoutes) {

    it(`should redirect ${scenario.previous} to ${scenario.expected}`, async () => {

      await harness.navigateByUrl(
        scenario.previous
      );

      expect(TestBed.inject(Router).url)
        .toBe(scenario.expected);

    });

  }


  // Conservación de información de navegación.

  it('should preserve comparison query parameters', async () => {

    await harness.navigateByUrl(
      '/user/compare'
      + '?evaluation_id_1=10'
      + '&evaluation_id_2=20'
    );

    const router = TestBed.inject(Router);

    const url = router.parseUrl(router.url);

    expect(router.url.split('?')[0])
      .toBe('/user/analysis/evolution/compare');

    expect(url.queryParams).toEqual({
      evaluation_id_1: '10',
      evaluation_id_2: '20'
    });

  });


  it('should preserve query parameters and fragments on legacy results', async () => {

    await harness.navigateByUrl(
      '/user/results?source=dashboard#summary'
    );

    const router = TestBed.inject(Router);

    const url = router.parseUrl(router.url);

    expect(url.queryParams).toEqual({
      source: 'dashboard'
    });

    expect(url.fragment).toBe('summary');

  });


  it('should preserve comparison parameters and fragment together', async () => {

    await harness.navigateByUrl(
      '/user/compare'
      + '?evaluation_id_1=10'
      + '&evaluation_id_2=20'
      + '#comparison'
    );

    const router = TestBed.inject(Router);

    const url = router.parseUrl(router.url);

    expect(url.queryParams).toEqual({
      evaluation_id_1: '10',
      evaluation_id_2: '20'
    });

    expect(url.fragment).toBe('comparison');

  });


  it('should preserve the improvement evaluation id and URL metadata', async () => {

    await harness.navigateByUrl(
      '/user/evaluations/37/improvement-plan'
      + '?source=results#actions'
    );

    const router = TestBed.inject(Router);

    const url = router.parseUrl(router.url);

    expect(router.url.split('?')[0])
      .toBe('/user/improvement/plan/37');

    expect(url.queryParams).toEqual({
      source: 'results'
    });

    expect(url.fragment).toBe('actions');

  });


  // Rutas predeterminadas.

  it('should redirect the analysis root to results', async () => {

    await harness.navigateByUrl('/user/analysis');

    expect(TestBed.inject(Router).url)
      .toBe('/user/analysis/results');

  });


  it('should redirect the improvement root to recommendations', async () => {

    await harness.navigateByUrl('/user/improvement');

    expect(TestBed.inject(Router).url)
      .toBe('/user/improvement/recommendations');

  });


  it('should redirect the user root to home', async () => {

    await harness.navigateByUrl('/user');

    expect(TestBed.inject(Router).url)
      .toBe('/user/home');

  });


  // Rutas que deben permanecer disponibles.

  const preservedRoutes = [

    '/user/evaluation',

    '/user/company-settings',

    '/user/members',

    '/user/improvement/plan',

    '/user/improvement/plan/10'

  ];


  for (const path of preservedRoutes) {

    it(`should preserve the canonical route ${path}`, async () => {

      await harness.navigateByUrl(path);

      expect(TestBed.inject(Router).url)
        .toBe(path);

    });

  }


  // Configuración original de seguridad.

  it('should preserve user authentication and authorization guards', () => {

    expect(userRoute.canActivate)
      .toContain(authGuard);

    expect(userRoute.canActivate)
      .toContain(userGuard);

  });


  it('should protect all analysis children with the company guard', () => {

    expect(analysisRoute.canActivateChild)
      .toContain(companySelectedGuard);

  });


  it('should protect all improvement children with the company guard', () => {

    expect(improvementRoute.canActivateChild)
      .toContain(companySelectedGuard);

  });


  it('should preserve the evaluation company and exit guards', () => {

    const evaluationRoute = userChildren.find(
      route => route.path === 'evaluation'
    );

    expect(evaluationRoute).toBeDefined();

    expect(evaluationRoute?.canActivate)
      .toContain(companySelectedGuard);

    expect(evaluationRoute?.canDeactivate)
      .toContain(evaluationExitGuard);

  });


  it('should protect company settings with the selected company guard', () => {

    const companyRoute = userChildren.find(
      route => route.path === 'company-settings'
    );

    expect(companyRoute).toBeDefined();

    expect(companyRoute?.canActivate)
      .toContain(companySelectedGuard);

  });


  it('should preserve the administrator guard for the standalone members route', () => {

    const membersRoute = userChildren.find(
      route => route.path === 'members'
    );

    expect(membersRoute).toBeDefined();

    expect(membersRoute?.canActivate)
      .toContain(companyAdminGuard);

  });


  it('should preserve lazy loading for the reorganized modules', () => {

    expect(typeof analysisRoute.loadComponent)
      .toBe('function');

    expect(typeof improvementRoute.loadComponent)
      .toBe('function');

    for (const route of [
      ...analysisRoute.children!,
      ...improvementRoute.children!
    ]) {

      if (route.redirectTo === undefined) {

        expect(typeof route.loadComponent)
          .withContext(route.path ?? '')
          .toBe('function');

      }

    }

  });

});
