
import {
  Routes,
  Router,
  RedirectFunction
} from '@angular/router';

import { inject } from '@angular/core';

import { authGuard } from '../core/guards/auth.guard';
import { adminGuard } from '../core/guards/admin.guard';
import { userGuard } from '../core/guards/user.guard';
import { evaluationExitGuard } from '../core/guards/evaluation-exit.guard';
import { companyAdminGuard } from '../core/guards/company-admin.guard';
import { companySelectedGuard } from '../core/guards/company-selected.guard';

/**
 * Conserva los parámetros de consulta y fragmentos
 * de las rutas anteriores durante la migración.
 */
const redirectUserRoute = (
  destination: string
): RedirectFunction => {

  return ({ queryParams, fragment }) => {

    return inject(Router).createUrlTree(
      [destination],
      {
        queryParams,
        fragment: fragment ?? undefined
      }
    );

  };

};

export const pagesRoutes: Routes = [

  {
    path: 'home',
    loadComponent: () =>
      import('./home/home.component')
        .then(m => m.HomeComponent)
  },

  {
    path: 'admin',
    loadComponent: () =>
      import('./admin/layout/admin-layout/admin-layout.component')
        .then(m => m.AdminLayoutComponent),

    canActivate: [authGuard, adminGuard],

    children: [

      {
        path: 'dashboard',
        loadComponent: () =>
          import('./admin/dashboard/dashboard.component')
            .then(m => m.DashboardComponent)
      },

      {
        path: 'ambits',
        loadComponent: () =>
          import('./admin/ambits/ambits.component')
            .then(m => m.AmbitsComponent)
      },

      {
        path: 'maturity-levels',
        loadComponent: () =>
          import('./admin/maturity-levels/maturity-levels.component')
            .then(m => m.MaturityLevelsComponent)
      },

      {
        path: 'users',
        loadComponent: () =>
          import('./admin/users/users.component')
            .then(m => m.UsersComponent)
      },

      {
        path: 'company',
        loadComponent: () =>
          import('./admin/company/company.component')
            .then(m => m.CompanyComponent)
      },

      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
      }

    ]
  },

  {
    path: 'user',

    loadComponent: () =>
      import('./user/user-layout/user-layout.component')
        .then(m => m.UserLayoutComponent),

    canActivate: [authGuard, userGuard],

    children: [

      {
        path: 'home',
        loadComponent: () =>
          import('./user/user-home/user-home.component')
            .then(m => m.UserHomeComponent)
      },

      {
        path: 'evaluation',

        loadComponent: () =>
          import('./user/evaluation/evaluation.component')
            .then(m => m.EvaluationComponent),

        canDeactivate: [evaluationExitGuard],
        canActivate: [companySelectedGuard]
      },

      // HU-058: módulo de Análisis ASG.

      {
        path: 'analysis',

        loadComponent: () =>
          import('./user/analysis/analysis.component')
            .then(m => m.AnalysisComponent),

        canActivateChild: [companySelectedGuard],

        children: [

          {
            path: 'results',

            loadComponent: () =>
              import('./user/results/results.component')
                .then(m => m.ResultsComponent)
          },

          {
            path: 'evolution/compare',

            loadComponent: () =>
              import('./user/compare/compare.component')
                .then(m => m.CompareComponent)
          },

          {
            path: 'evolution',

            loadComponent: () =>
              import('./user/history/history.component')
                .then(m => m.HistoryComponent)
          },

          {
            path: 'benchmark',

            loadComponent: () =>
              import('./user/benchmark/benchmark.component')
                .then(m => m.BenchmarkComponent)
          },

          {
            path: '',
            redirectTo: 'results',
            pathMatch: 'full'
          }

        ]
      },

      // Compatibilidad con rutas analíticas anteriores.

      {
        path: 'results',
        pathMatch: 'full',

        redirectTo: redirectUserRoute(
          '/user/analysis/results'
        )
      },

      {
        path: 'history',
        pathMatch: 'full',

        redirectTo: redirectUserRoute(
          '/user/analysis/evolution'
        )
      },

      {
        path: 'compare',
        pathMatch: 'full',

        redirectTo: redirectUserRoute(
          '/user/analysis/evolution/compare'
        )
      },

      {
        path: 'benchmark',
        pathMatch: 'full',

        redirectTo: redirectUserRoute(
          '/user/analysis/benchmark'
        )
      },

      // Módulos pendientes de reorganización.

      {
        path: 'feedback',
        pathMatch: 'full',

        redirectTo: redirectUserRoute(
          '/user/improvement/recommendations'
        )
      },


      {
        path: 'evaluations/:evaluationId/improvement-plan',

        pathMatch: 'full',

        redirectTo: ({ params, queryParams, fragment }) => {

          return inject(Router).createUrlTree(
            [
              '/user/improvement/plan',
              params['evaluationId']
            ],
            {
              queryParams,
              fragment: fragment ?? undefined
            }
          );

        }
      },


      {
        path: 'company-settings',

        loadComponent: () =>
          import('./user/company-settings/company-settings-page/company-settings-page.component')
            .then(m => m.CompanySettingsPageComponent),

        canActivate: [companySelectedGuard]
      },

      {
        path: 'members',

        loadComponent: () =>
          import('./user/company-members/company-members.component')
            .then(m => m.CompanyMembersComponent),

        canActivate: [companyAdminGuard]
      },

      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      },

      // HU-058: módulo de Mejora ASG.

      {
        path: 'improvement',

        loadComponent: () =>
          import('./user/improvement/improvement.component')
            .then(m => m.ImprovementComponent),

        canActivateChild: [companySelectedGuard],

        children: [

          {
            path: 'recommendations',

            loadComponent: () =>
              import('./user/feedback/feedback.component')
                .then(m => m.FeedbackComponent)
          },

          {
            path: 'plan/:evaluationId',

            loadComponent: () =>
              import('./user/improvement-plan/improvement-plan.component')
                .then(m => m.ImprovementPlanComponent)
          },

          {
            path: 'plan',

            loadComponent: () =>
              import('./user/improvement/plan-selector/plan-selector.component')
                .then(m => m.PlanSelectorComponent)
          },

          {
            path: '',
            redirectTo: 'recommendations',
            pathMatch: 'full'
          }

        ]
      },


    ]
  },

  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full'
  }

];
