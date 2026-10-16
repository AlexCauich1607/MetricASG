import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';
import { IndicatorService } from './indicator.service';

describe('IndicatorService', () => {
  let service: IndicatorService;

  beforeEach(() => {
     TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withXhr())
      ]
    });
    service = TestBed.inject(IndicatorService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
