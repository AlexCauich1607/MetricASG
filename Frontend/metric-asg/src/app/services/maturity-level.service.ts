import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BaseService } from './base.service';
import { MaturityLevel } from '../models/maturity_level';


@Injectable({
  providedIn: 'root'
})
export class MaturityLevelService extends BaseService<MaturityLevel> {

  constructor(http: HttpClient) {
    super(http, 'maturity-levels');
  }
}
