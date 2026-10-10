import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { IndicatorAnswerService } from './indicator-answer.service';

describe('IndicatorAnswerService', () => {
  let service: IndicatorAnswerService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient()
      ]
    });
    service = TestBed.inject(IndicatorAnswerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
