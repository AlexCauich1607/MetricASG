import { TestBed } from '@angular/core/testing';

import { MaturityLevelService } from './maturity-level.service';

describe('MaturityLevelService', () => {
  let service: MaturityLevelService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MaturityLevelService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
