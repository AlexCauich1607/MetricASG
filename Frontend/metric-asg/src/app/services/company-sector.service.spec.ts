import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';

import { CompanySectorService } from './company-sector.service';

describe('CompanySectorService', () => {
  let service: CompanySectorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr())
      ]
    });

    service = TestBed.inject(CompanySectorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});