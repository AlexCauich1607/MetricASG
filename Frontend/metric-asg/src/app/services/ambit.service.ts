import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Ambit } from '../models/ambit';
import { BaseService } from './base.service';

@Injectable({
  providedIn: 'root'
})
export class AmbitService extends BaseService<Ambit> {

  constructor(http: HttpClient) {
    super(http, 'ambits');
  }
}
