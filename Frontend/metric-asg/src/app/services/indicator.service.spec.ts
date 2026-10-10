import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { IndicatorService } from './indicator.service';

describe('IndicatorService', () => {
  let service: IndicatorService;

  beforeEach(() => {
     TestBed.configureTestingModule({
      providers: [
        provideHttpClient()
      ]
    });
    service = TestBed.inject(IndicatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
