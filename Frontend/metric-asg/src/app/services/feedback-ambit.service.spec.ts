import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { FeedbackAmbitService } from './feedback-ambit.service';

describe('FeedbackAmbitService', () => {
  let service: FeedbackAmbitService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient()
      ]
    });
    service = TestBed.inject(FeedbackAmbitService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
