import { Routes } from '@angular/router';
import { authGuard } from '../core/guards/auth.guard';
import { adminGuard } from '../core/guards/admin.guard';
import { userGuard } from '../core/guards/user.guard';
import { evaluationExitGuard } from '../core/guards/evaluation-exit.guard';
import { companyAdminGuard } from '../core/guards/company-admin.guard';
import { companySelectedGuard } from '../core/guards/company-selected.guard';

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
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
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
      {
        path: 'feedback',
        loadComponent: () =>
          import('./user/feedback/feedback.component')
            .then(m => m.FeedbackComponent),
        canActivate: [companySelectedGuard]
      },
      {
        path: 'results',
        loadComponent: () =>
          import('./user/results/results.component')
            .then(m => m.ResultsComponent),
        canActivate: [companySelectedGuard]
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./user/history/history.component')
            .then(m => m.HistoryComponent),
        canActivate: [companySelectedGuard]
      },
      {
        path: 'benchmark',
        loadComponent: () =>
          import('./user/benchmark/benchmark.component')
            .then(m => m.BenchmarkComponent),
        canActivate: [companySelectedGuard]
      },
      {
        path: 'evaluations/:evaluationId/improvement-plan',
        loadComponent: () =>
          import('./user/improvement-plan/improvement-plan.component')
            .then(m => m.ImprovementPlanComponent),
        canActivate: [companySelectedGuard]
      },

      {
        path: 'compare',
        loadComponent: () =>
          import('./user/compare/compare.component')
            .then(m => m.CompareComponent),
        canActivate: [companySelectedGuard]
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

      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  },

  { path: '', redirectTo: 'home', pathMatch: 'full' }
];