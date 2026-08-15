import { Injectable } from '@angular/core';
import { BaseService } from './base.service';
import { Indicator } from '../models/indicator';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class IndicatorService extends BaseService<Indicator> {

  constructor(http: HttpClient) {
    super(http, 'indicators');
  }
}