import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { AdminLayoutComponent } from './admin/layout/admin-layout/admin-layout.component';
import { DashboardComponent } from './admin/dashboard/dashboard.component';
import { AmbitsComponent } from './admin/ambits/ambits.component';
import { MaturityLevelsComponent } from './admin/maturity-levels/maturity-levels.component';
import { EvaluationComponent } from './user/evaluation/evaluation.component';
import { UserHomeComponent } from './user/user-home/user-home.component';
import { FeedbackComponent } from './user/feedback/feedback.component';
import { ResultsComponent } from './user/results/results.component';
import { HistoryComponent } from './user/history/history.component';
import { UserLayoutComponent } from './user/user-layout/user-layout.component';
import { UsersComponent } from './admin/users/users.component';
import { SingUpComponent } from './sing-up/sing-up.component';
import { CompanyComponent } from './admin/company/company.component';
import { AdminGuard } from '../core/guards/admin.guard';
import { AuthGuard } from '../core/guards/auth.guard';
import { UserGuard } from '../core/guards/user.guard';

const routes: Routes = [

  { path: 'home', component: HomeComponent },
  { path: 'login', component: LoginComponent },
  { path: 'sing-up', component: SingUpComponent },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [AuthGuard, AdminGuard],
    children: [
      { path: 'dashboard', component: DashboardComponent },
      { path: 'ambits', component: AmbitsComponent },
      { path: 'maturity-levels', component: MaturityLevelsComponent },
      { path: 'users', component: UsersComponent },
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
      { path: 'evaluation', component: EvaluationComponent },
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
