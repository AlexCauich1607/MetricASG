import { Injectable } from '@angular/core';
import { BaseService } from './base.service';
import { HttpClient } from '@angular/common/http';
import { IndicatorAnswer } from '../models/indicator_answer';

@Injectable({
  providedIn: 'root'
})
export class IndicatorAnswerService extends BaseService<IndicatorAnswer> {

  constructor(http: HttpClient) {
    super(http, 'indicator-answers');
  }
}
