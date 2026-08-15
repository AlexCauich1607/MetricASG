import { TestBed } from '@angular/core/testing';

import { IndicatorAnswerService } from './indicator-answer.service';

describe('IndicatorAnswerService', () => {
  let service: IndicatorAnswerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(IndicatorAnswerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
