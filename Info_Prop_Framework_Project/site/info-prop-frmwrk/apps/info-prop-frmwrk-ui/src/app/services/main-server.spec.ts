import { TestBed } from '@angular/core/testing';

import { MainServer } from './main-server';

describe('MainServer', () => {
  let service: MainServer;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MainServer);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
