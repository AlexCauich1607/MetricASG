import { TestBed } from '@angular/core/testing';

import { AmbitService } from './ambit.service';

describe('AmbitService', () => {
  let service: AmbitService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AmbitService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
