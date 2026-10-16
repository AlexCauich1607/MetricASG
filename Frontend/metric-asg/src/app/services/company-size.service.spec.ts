import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';

import { CompanySizeService } from './company-size.service';

describe('CompanySizeService', () => {
  let service: CompanySizeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr())
      ]
    });

    service = TestBed.inject(CompanySizeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});