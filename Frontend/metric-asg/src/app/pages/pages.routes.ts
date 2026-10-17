import { Routes } from '@angular/router';
import { AuthGuard } from '../core/guards/auth.guard';
import { AdminGuard } from '../core/guards/admin.guard';
import { UserGuard } from '../core/guards/user.guard';

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
    canActivate: [AuthGuard, AdminGuard],
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
    canActivate: [AuthGuard, UserGuard],
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
            .then(m => m.EvaluationComponent)
      },
      {
        path: 'feedback',
        loadComponent: () =>
          import('./user/feedback/feedback.component')
            .then(m => m.FeedbackComponent)
      },
      {
        path: 'results',
        loadComponent: () =>
          import('./user/results/results.component')
            .then(m => m.ResultsComponent)
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./user/history/history.component')
            .then(m => m.HistoryComponent)
      },
      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  },

  { path: '', redirectTo: 'home', pathMatch: 'full' }
];