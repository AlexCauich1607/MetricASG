import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';

import { AmbitService } from './ambit.service';

describe('AmbitService', () => {
  let service: AmbitService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient()
      ]
    });

    service = TestBed.inject(AmbitService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});