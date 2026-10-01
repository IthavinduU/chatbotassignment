import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { API_URL } from '../core/config';
import { ChatRequest, User } from '../core/models';
import { AuthService } from './auth.service';
import { RequestService } from './request.service';
import { SocketService } from './socket.service';
import { ToastService } from './toast.service';

const groupAdmin: User = { _id: 'u1', username: 'groupadmin', avatarUrl: null, role: 'groupAdmin' };

/** Builds a pending request of the given type. */
function makeRequest(id: string, type: ChatRequest['type']): ChatRequest {
  return { _id: id, type, status: 'pending', requesterId: 'u2', requesterName: 'user.1', reason: null, createdAt: '2026-01-01T00:00:00Z' };
}

describe('RequestService', () => {
  let service: RequestService;
  let http: HttpTestingController;
  let toast: ToastService;
  // Created fresh for every test so no test can affect another.
  let fakeSocket: { requestsChanged$: Subject<void> };
  let fakeAuth: { user: ReturnType<typeof signal<User | null>> };

  beforeEach(() => {
    fakeSocket = { requestsChanged$: new Subject<void>() };
    fakeAuth = { user: signal<User | null>(groupAdmin) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SocketService, useValue: fakeSocket },
        { provide: AuthService, useValue: fakeAuth },
      ],
    });
    service = TestBed.inject(RequestService);
    http = TestBed.inject(HttpTestingController);
    toast = TestBed.inject(ToastService);
    spyOn(toast, 'show');
  });

  afterEach(() => http.verify());

  it('counts incoming requests by type', () => {
    service.loadIncoming();
    http.expectOne(`${API_URL}/requests/incoming`).flush([
      makeRequest('r1', 'joinGroup'),
      makeRequest('r2', 'joinGroup'),
      makeRequest('r3', 'createChannel'),
    ]);
    expect(service.incomingCounts()).toEqual({ joinGroup: 2, createChannel: 1 });
  });

  it('shows a toast when new requests arrive', () => {
    service.loadIncoming();
    http.expectOne(`${API_URL}/requests/incoming`).flush([makeRequest('r1', 'joinGroup')]);
    service.loadIncoming(true);
    http.expectOne(`${API_URL}/requests/incoming`).flush([makeRequest('r1', 'joinGroup'), makeRequest('r2', 'leaveGroup')]);
    expect(toast.show).toHaveBeenCalledWith('You have a new request to review');
  });

  it('shows no toast when nothing new arrived', () => {
    service.loadIncoming();
    http.expectOne(`${API_URL}/requests/incoming`).flush([makeRequest('r1', 'joinGroup')]);
    service.loadIncoming(true);
    http.expectOne(`${API_URL}/requests/incoming`).flush([makeRequest('r1', 'joinGroup')]);
    expect(toast.show).not.toHaveBeenCalled();
  });

  it('only lets admins approve requests', () => {
    expect(service.canApprove()).toBeTrue();
    fakeAuth.user.set({ ...groupAdmin, role: 'user' });
    expect(service.canApprove()).toBeFalse();
  });

  it('sends a request and then refreshes "my requests"', () => {
    service.create({ type: 'joinGroup', groupId: 'g1' }).subscribe();
    const req = http.expectOne(`${API_URL}/requests`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ type: 'joinGroup', groupId: 'g1' });
    req.flush(makeRequest('r1', 'joinGroup'));
    http.expectOne(`${API_URL}/requests/mine`).flush([makeRequest('r1', 'joinGroup')]);
    expect(service.mine().length).toBe(1);
  });

  it('approves a request and then refreshes the incoming list', () => {
    service.approve('r1').subscribe();
    http.expectOne(`${API_URL}/requests/r1/approve`).flush({ ok: true });
    http.expectOne(`${API_URL}/requests/incoming`).flush([]);
    expect(service.incoming().length).toBe(0);
  });

  it('reloads requests when the server says they changed', () => {
    fakeSocket.requestsChanged$.next();
    http.expectOne(`${API_URL}/requests/mine`).flush([]);
    http.expectOne(`${API_URL}/requests/incoming`).flush([makeRequest('r1', 'joinGroup')]);
    expect(service.incoming().length).toBe(1);
  });
});