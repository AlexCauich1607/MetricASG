import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { UserHomeComponent } from './user/user-home/user-home.component';
import { FeedbackComponent } from './user/feedback/feedback.component';
import { ResultsComponent } from './user/results/results.component';
import { HistoryComponent } from './user/history/history.component';
import { UserLayoutComponent } from './user/user-layout/user-layout.component';
import { CompanyComponent } from './admin/company/company.component';
import { AdminGuard } from '../core/guards/admin.guard';
import { AuthGuard } from '../core/guards/auth.guard';
import { UserGuard } from '../core/guards/user.guard';

const routes: Routes = [

  { path: 'home', component: HomeComponent },
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
      { path: 'company', component: CompanyComponent },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  },
  {
    path: 'user',
    component: UserLayoutComponent,
    canActivate: [AuthGuard, UserGuard],
    children: [
      { path: 'home', component: UserHomeComponent },
      {
        path: 'evaluation',
        loadComponent: () =>
          import('./user/evaluation/evaluation.component')
            .then(m => m.EvaluationComponent)
      },
      { path: 'feedback', component: FeedbackComponent },
      { path: 'results', component: ResultsComponent },
      { path: 'history', component: HistoryComponent },
      { path: '', redirectTo: 'home', pathMatch: 'full' }
    ]
  },
  { path: '', redirectTo: 'home', pathMatch: 'full' }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class PagesRoutingModule { }
