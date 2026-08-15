import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FooterComponent } from './footer/footer.component';
import { NavbarComponent } from './navbar/navbar.component';
import { AppComponent } from '../app.component';
import { FeedbackComponent } from './feedback/feedback.component';

import { BarChartComponent } from './bar-chart/bar-chart.component';
import { AmbitCardComponent } from './ambit-card/ambit-card.component';
import { PdfReportTemplateComponent } from './pdf-template/pdf-template.component';
import { ProfilePhotoComponent } from './profile-photo/profile-photo.component';



@NgModule({
  declarations: [
    FooterComponent,
    NavbarComponent,
    FeedbackComponent,
    BarChartComponent,
    AmbitCardComponent,
    PdfReportTemplateComponent,
    ProfilePhotoComponent,
  ],
  imports: [
    CommonModule
  ],
  exports: [
    FooterComponent,
    NavbarComponent,
    FeedbackComponent,
    BarChartComponent,
    AmbitCardComponent,
    PdfReportTemplateComponent,
    ProfilePhotoComponent
  ]
  
})
export class SharedModule { }
