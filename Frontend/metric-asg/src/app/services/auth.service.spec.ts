import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';
import { provideHttpClient, withXhr } from '@angular/common/http';

import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpTestingController: HttpTestingController;

  const apiUrl = 'http://localhost:8000/api/auth/';

  beforeEach(() => {
    sessionStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(withXhr()),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(AuthService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
    sessionStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
  it('should register a personal account without company data', () => {
    const personalData = {
      name: 'Alex',
      lastname: 'Cauich',
      position: 'Developer',
      email: 'personal@test.com',
      phone: '9999999999',
      password: 'Password123!'
    };

    service.createUser(personalData).subscribe(response => {
      expect(response.id).toBe(10);
      expect(response.company_name).toBeNull();
    });

    const request = httpTestingController.expectOne(
      `${apiUrl}register`
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(personalData);

    expect(request.request.body.company_name).toBeUndefined();
    expect(request.request.body.company_sector_id).toBeUndefined();
    expect(request.request.body.company_size_id).toBeUndefined();

    request.flush({
      id: 10,
      ...personalData,
      company_name: null,
      company_sector_id: null,
      company_size_id: null,
      role: 'USER',
      active: true
    });
  });

  it('should propagate personal registration errors', () => {
    const personalData = {
      name: 'Alex',
      lastname: 'Cauich',
      position: 'Developer',
      email: 'existing@test.com',
      phone: '9999999999',
      password: 'Password123!'
    };

    let errorStatus: number | undefined;

    service.createUser(personalData).subscribe({
      next: () => fail('Expected registration to fail'),
      error: error => {
        errorStatus = error.status;
      }
    });

    const request = httpTestingController.expectOne(
      `${apiUrl}register`
    );

    request.flush(
      { detail: 'Email already registered' },
      {
        status: 409,
        statusText: 'Conflict'
      }
    );

    expect(errorStatus).toBe(409);
  });
  it('should login successfully and store session data', () => {
    const loginData = {
      email: 'user@test.com',
      password: 'password123'
    };

    const authResponse = {
      access_token: 'test-access-token',
      token_type: 'bearer',
      user: {
        id: 1,
        name: 'Alex',
        company_name: 'MetricASG',
        profile_photo: 'photo.jpg',
        role: 'USER',
        email: 'user@test.com',
        last_login: '2026-10-01T16:00:00'
      }
    };

    service.login(loginData as any).subscribe(response => {
      expect(response).toEqual(authResponse);
    });

    const request = httpTestingController.expectOne(
      `${apiUrl}login`
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(loginData);
    expect(request.request.withCredentials).toBeTrue();

    request.flush(authResponse);

    expect(JSON.parse(sessionStorage.getItem('user')!))
      .toBe('Alex');

    expect(JSON.parse(sessionStorage.getItem('role')!))
      .toBe('USER');

    expect(JSON.parse(sessionStorage.getItem('token')!))
      .toBe('test-access-token');

    expect(JSON.parse(sessionStorage.getItem('company')!))
      .toBe('MetricASG');

    expect(JSON.parse(sessionStorage.getItem('id')!))
      .toBe(1);

    expect(JSON.parse(sessionStorage.getItem('photo')!))
      .toBe('photo.jpg');
  });

  it('should propagate login errors', () => {
    const loginData = {
      email: 'user@test.com',
      password: 'wrong-password'
    };

    let errorResponse: any;

    service.login(loginData as any).subscribe({
      next: () => fail('Expected login to fail'),
      error: error => {
        errorResponse = error;
      }
    });

    const request = httpTestingController.expectOne(
      `${apiUrl}login`
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.withCredentials).toBeTrue();

    request.flush(
      {
        detail: 'Incorrect email or password'
      },
      {
        status: 401,
        statusText: 'Unauthorized'
      }
    );

    expect(errorResponse.status).toBe(401);
  });

  it('should refresh the token successfully', () => {
    const refreshResponse = {
      token: 'new-access-token'
    };

    service.refreshToken().subscribe(response => {
      expect(response).toEqual(refreshResponse);
    });

    const request = httpTestingController.expectOne(
      `${apiUrl}refresh-token`
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    expect(request.request.withCredentials).toBeTrue();

    request.flush(refreshResponse);
  });

  it('should propagate refresh token errors', () => {
    let errorResponse: any;

    service.refreshToken().subscribe({
      next: () => fail('Expected refresh token to fail'),
      error: error => {
        errorResponse = error;
      }
    });

    const request = httpTestingController.expectOne(
      `${apiUrl}refresh-token`
    );

    request.flush(
      {
        detail: 'Refresh token expired'
      },
      {
        status: 401,
        statusText: 'Unauthorized'
      }
    );

    expect(errorResponse.status).toBe(401);
  });

  it('should logout successfully', () => {
    const logoutResponse = {
      success: true
    };

    service.logout().subscribe(response => {
      expect(response).toEqual(logoutResponse);
    });

    const request = httpTestingController.expectOne(
      `${apiUrl}logout`
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    expect(request.request.withCredentials).toBeTrue();

    request.flush(logoutResponse);
  });

  it('should propagate logout errors', () => {
    let errorResponse: any;

    service.logout().subscribe({
      next: () => fail('Expected logout to fail'),
      error: error => {
        errorResponse = error;
      }
    });

    const request = httpTestingController.expectOne(
      `${apiUrl}logout`
    );

    request.flush(
      {
        detail: 'Logout failed'
      },
      {
        status: 500,
        statusText: 'Internal Server Error'
      }
    );

    expect(errorResponse.status).toBe(500);
  });
  it('should login a personal user without a company', () => {
    const loginData = {
      email: 'personal@test.com',
      password: 'Password123!'
    };

    const authResponse = {
      access_token: 'personal-access-token',
      token_type: 'bearer',
      user: {
        id: 15,
        name: 'Personal',
        company_name: null,
        profile_photo: null,
        role: 'USER',
        email: 'personal@test.com',
        last_login: '2026-11-21T10:00:00'
      }
    };

    service.login(loginData).subscribe(response => {
      expect(response).toEqual(authResponse);
    });

    const request = httpTestingController.expectOne(
      `${apiUrl}login`
    );

    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(loginData);
    expect(request.request.withCredentials).toBeTrue();

    request.flush(authResponse);

    expect(JSON.parse(sessionStorage.getItem('user')!))
      .toBe('Personal');

    expect(JSON.parse(sessionStorage.getItem('token')!))
      .toBe('personal-access-token');

    expect(JSON.parse(sessionStorage.getItem('company')!))
      .toBe('');

    expect(JSON.parse(sessionStorage.getItem('id')!))
      .toBe(15);
  });
});