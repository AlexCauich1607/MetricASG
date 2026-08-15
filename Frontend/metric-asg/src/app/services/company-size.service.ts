import { Injectable } from '@angular/core';
import { BaseService } from './base.service';
import { CompanySize } from '../models/company_size';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class CompanySizeService extends BaseService<CompanySize> {

  constructor(http: HttpClient) { 
    super(http, 'company-sizes'); 
  }
}
