import { TestBed } from '@angular/core/testing';

import { FeedbackAmbitService } from './feedback-ambit.service';

describe('FeedbackAmbitService', () => {
  let service: FeedbackAmbitService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FeedbackAmbitService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
