import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { PagesRoutingModule } from './pages-routing.module';
import { HomeComponent } from './home/home.component';
import { LoginComponent } from './login/login.component';
import { AdminLayoutComponent } from './admin/layout/admin-layout/admin-layout.component';
import { DashboardComponent } from './admin/dashboard/dashboard.component';
import { SidebarComponent } from './admin/sidebar/sidebar.component';
import { SharedModule } from '../shared/shared.module';
import { AmbitsComponent } from './admin/ambits/ambits.component';
import { MaturityLevelsComponent } from './admin/maturity-levels/maturity-levels.component';
import { FormsModule } from '@angular/forms';

import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';

import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ReactiveFormsModule } from '@angular/forms';
import { MaturityLevelFormComponent } from './modals/maturity-level-form/maturity-level-form.component';
import { AmbitFormComponent } from './modals/ambit-form/ambit-form.component';
import { IndicatorsFormComponent } from './modals/indicators-form/indicators-form.component';
import { FeedbacksFormComponent } from './modals/feedbacks-form/feedbacks-form.component';
import { EvaluationComponent } from './user/evaluation/evaluation.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserHomeComponent } from './user/user-home/user-home.component';
import { NgxChartsModule } from '@swimlane/ngx-charts';
import { ResultsComponent } from './user/results/results.component';
import { FeedbackComponent } from './user/feedback/feedback.component';
import { HistoryComponent } from './user/history/history.component';
import { UserLayoutComponent } from './user/user-layout/user-layout.component';
import { UserNavbarComponent } from './user/user-navbar/user-navbar.component';
import { UsersComponent } from './admin/users/users.component';
import { UserFormComponent } from './modals/user-form/user-form.component';
import { SingUpComponent } from './sing-up/sing-up.component';

import { MatStepperModule } from '@angular/material/stepper';
import { CompanyComponent } from './admin/company/company.component';
import { SectorFormComponent } from './modals/sector-form/sector-form.component';
import { SizeFormComponent } from './modals/size-form/size-form.component';
import { ReportModalComponent } from './modals/report-modal/report-modal.component';
import { DownloadReportComponent } from './user/download-report/download-report.component';
import { UserSettingsComponent } from './modals/settings/user-settings/user-settings.component';

import { SidebarComponent as Sider } from './modals/settings/sidebar/sidebar.component';
import { CompanySettingsComponent } from './modals/settings/company-settings/company-settings.component';
import { ContactSettingsComponent } from './modals/settings/contact-settings/contact-settings.component';
import { SearchFilterComponent } from './modals/search-filter/search-filter.component';

@NgModule({
  declarations: [
    HomeComponent,
    LoginComponent,
    AdminLayoutComponent,
    DashboardComponent,
    SidebarComponent,
    AmbitsComponent,
    MaturityLevelsComponent,
    MaturityLevelFormComponent,
    AmbitFormComponent,
    IndicatorsFormComponent,
    FeedbacksFormComponent,
    EvaluationComponent,
    UserHomeComponent,
    ResultsComponent,
    FeedbackComponent,
    HistoryComponent,
    UserLayoutComponent,
    UserNavbarComponent,
    UsersComponent,
    UserFormComponent,
    SingUpComponent,
    CompanyComponent,
    SectorFormComponent,
    SizeFormComponent,
    ReportModalComponent,
    DownloadReportComponent,
    UserSettingsComponent,
    Sider,
    CompanySettingsComponent,
    ContactSettingsComponent,
    SearchFilterComponent
  ],
  imports: [
    CommonModule,
    PagesRoutingModule,
    MatIconModule,
    SharedModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    NgxChartsModule,
    MatStepperModule,
    MatSelectModule,
    MatOptionModule
  ],
  exports: [
    Sider
  ]
})
export class PagesModule { }
