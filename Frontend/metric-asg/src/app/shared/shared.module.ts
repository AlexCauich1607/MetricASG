import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FooterComponent } from './footer/footer.component';
import { NavbarComponent } from './navbar/navbar.component';
import { AppComponent } from '../app.component';
import { FeedbackComponent } from './feedback/feedback.component';

import { BarChartComponent } from './bar-chart/bar-chart.component';
import { PdfReportTemplateComponent } from './pdf-template/pdf-template.component';
import { ProfilePhotoComponent } from './profile-photo/profile-photo.component';
import { AmbitCardComponent } from './ambit-card/ambit-card.component';



@NgModule({
  declarations: [
    FeedbackComponent,
    PdfReportTemplateComponent,
    ProfilePhotoComponent,
  ],
  imports: [
    CommonModule,
    FooterComponent,
    BarChartComponent,
    AmbitCardComponent,
    NavbarComponent,
  ],
  exports: [
    FooterComponent,
    NavbarComponent,
    FeedbackComponent,
    BarChartComponent,
    PdfReportTemplateComponent,
    ProfilePhotoComponent,
    AmbitCardComponent
  ]

})
export class SharedModule { }
