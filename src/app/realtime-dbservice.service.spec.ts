import { TestBed } from '@angular/core/testing';

import { RealtimeDBserviceService } from './realtime-dbservice.service';

describe('RealtimeDBserviceService', () => {
  let service: RealtimeDBserviceService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RealtimeDBserviceService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
