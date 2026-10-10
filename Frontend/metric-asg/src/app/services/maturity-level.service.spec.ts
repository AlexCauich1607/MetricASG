import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { MaturityLevelService } from './maturity-level.service';

describe('MaturityLevelService', () => {
  let service: MaturityLevelService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient()
      ]
    });

    service = TestBed.inject(MaturityLevelService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});