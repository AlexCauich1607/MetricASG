import { Injectable } from '@angular/core';
import { BaseService } from './base.service';
import { CompanySector } from '../models/company_sector';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class CompanySectorService extends BaseService<CompanySector> {

  constructor(http: HttpClient) { 
    super(http, 'company-sectors');
  }
}
