import { Injectable } from '@angular/core';
import { BaseService } from './base.service';
import { FeedbackAmbit } from '../models/feedback_ambit';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root'
})
export class FeedbackAmbitService  extends BaseService<FeedbackAmbit> {

  constructor(http: HttpClient) {
    super(http, 'feedback-ambit');
  }
}