import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { API_URL } from '../core/config';
import { Group, Member, User } from '../core/models';
import { AuthService } from './auth.service';
import { GroupService } from './group.service';
import { SocketService } from './socket.service';

const groupAdmin: User = { _id: 'u1', username: 'groupadmin', avatarUrl: null, role: 'groupAdmin' };

const studyGroup: Group = {
  _id: 'g1',
  name: 'Study Group',
  theme: 'blue',
  ageLimit: null,
  adminIds: ['u1'],
  memberIds: ['u1', 'u2'],
  pastMemberIds: [],
  bannedIds: [],
  createdAt: '2026-01-01T00:00:00Z',
  channels: [],
};

describe('GroupService', () => {
  let service: GroupService;
  let http: HttpTestingController;
  // Fakes stand in for the real socket and sign-in, so no server is needed.
  // They are created fresh for every test so no test can affect another.
  let fakeSocket: { online: ReturnType<typeof signal<Set<string>>>; groupsChanged$: Subject<void> };
  let fakeAuth: { user: ReturnType<typeof signal<User | null>> };

  beforeEach(() => {
    fakeSocket = { online: signal(new Set<string>()), groupsChanged$: new Subject<void>() };
    fakeAuth = { user: signal<User | null>(groupAdmin) };
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SocketService, useValue: fakeSocket },
        { provide: AuthService, useValue: fakeAuth },
      ],
    });
    service = TestBed.inject(GroupService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the groups the user belongs to', () => {
    service.load().subscribe();
    http.expectOne(`${API_URL}/groups/mine`).flush([studyGroup]);
    expect(service.groups().length).toBe(1);
    expect(service.loaded()).toBeTrue();
  });

  it('knows when the user is an admin of a group', () => {
    expect(service.isAdmin(studyGroup)).toBeTrue();
    expect(service.isAdmin({ ...studyGroup, adminIds: ['someone-else'] })).toBeFalse();
    expect(service.isAdmin(null)).toBeFalse();
  });

  it('lists only the members who are online', () => {
    const members: Member[] = [
      { _id: 'u1', username: 'groupadmin', avatarUrl: null, role: 'groupAdmin', isAdmin: true },
      { _id: 'u2', username: 'user.1', avatarUrl: null, role: 'user', isAdmin: false },
    ];
    service.members.set({ current: members });
    fakeSocket.online.set(new Set(['u2']));
    expect(service.onlineMembers().map((m) => m.username)).toEqual(['user.1']);
  });

  it('reloads groups when the server says they changed', () => {
    fakeSocket.groupsChanged$.next();
    http.expectOne(`${API_URL}/groups/mine`).flush([studyGroup]);
    expect(service.groups()[0].name).toBe('Study Group');
  });

  it('saves group settings and then reloads groups', () => {
    service.update('g1', { theme: 'red' }).subscribe();
    const req = http.expectOne(`${API_URL}/groups/g1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ theme: 'red' });
    req.flush({ group: { ...studyGroup, theme: 'red' }, removedForAge: [] });
    http.expectOne(`${API_URL}/groups/mine`).flush([{ ...studyGroup, theme: 'red' }]);
    expect(service.groups()[0].theme).toBe('red');
  });

  it('uploads a chat image as form data', () => {
    const file = new File(['image'], 'photo.png', { type: 'image/png' });
    service.uploadImage(file).subscribe();
    const req = http.expectOne(`${API_URL}/uploads`);
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get('image')).toBe(file);
    req.flush({ url: '/uploads/photo.png' });
  });
});