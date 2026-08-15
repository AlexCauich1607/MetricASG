import { TestBed } from '@angular/core/testing';

import { CompanySectorService } from './company-sector.service';

describe('CompanySectorService', () => {
  let service: CompanySectorService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CompanySectorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
