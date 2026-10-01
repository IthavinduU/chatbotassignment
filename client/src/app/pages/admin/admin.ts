import { DatePipe, KeyValuePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { merge, Observable } from 'rxjs';
import { Logo } from '../../components/logo';
import { errorMessage } from '../../core/error';
import { AuditEntry, ChatRequest, describeRequest, REQUEST_LABELS, ROLE_LABELS, User } from '../../core/models';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../services/auth.service';
import { RequestService } from '../../services/request.service';
import { SocketService } from '../../services/socket.service';
import { ToastService } from '../../services/toast.service';

type Tab = 'requests' | 'users' | 'bans' | 'audit';

/** Super admin console. Super admins manage the system but never chat with users directly. */
@Component({
  selector: 'app-admin-page',
  imports: [FormsModule, DatePipe, KeyValuePipe, Logo],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class AdminPage implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly requests = inject(RequestService);
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly tab = signal<Tab>('requests');
  protected readonly busy = signal(false);
  protected readonly labels = REQUEST_LABELS;
  protected readonly roleLabels = ROLE_LABELS;
  protected readonly describe = describeRequest;

  protected readonly users = signal<User[]>([]);
  protected readonly hardBanned = signal<User[]>([]);
  protected readonly banLog = signal<AuditEntry[]>([]);

  // Audit log filters
  protected readonly auditTypes = signal<string[]>([]);
  protected readonly auditEntries = signal<AuditEntry[]>([]);
  protected auditType = '';
  protected auditOrder: 'desc' | 'asc' = 'desc';
  protected auditFrom = '';
  protected auditTo = '';
  protected readonly groupByType = signal(false);
  protected readonly auditGroups = computed(() => {
    const groups = new Map<string, AuditEntry[]>();
    for (const e of this.auditEntries()) groups.set(e.type, [...(groups.get(e.type) ?? []), e]);
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  });

  constructor() {
    const socket = inject(SocketService);
    merge(socket.bansChanged$, socket.requestsChanged$).pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.tab() === 'bans') this.loadBans();
    });
  }

  ngOnInit(): void {
    this.requests.loadIncoming();
    this.loadUsers();
  }

  show(tab: Tab): void {
    this.tab.set(tab);
    if (tab === 'requests') this.requests.loadIncoming();
    if (tab === 'users') this.loadUsers();
    if (tab === 'bans') this.loadBans();
    if (tab === 'audit') this.loadAudit();
  }

  // ---- requests ----
  decide(r: ChatRequest, approve: boolean): void {
    this.run(approve ? this.requests.approve(r._id) : this.requests.reject(r._id), approve ? 'Request approved' : 'Request rejected');
  }

  // ---- users ----
  loadUsers(): void {
    this.admin.users().subscribe((u) => this.users.set(u));
  }

  changeRole(user: User, role: 'user' | 'groupAdmin'): void {
    this.run(this.admin.setRole(user._id, role), `${user.username} is now a ${ROLE_LABELS[role].toLowerCase()}`, () => this.loadUsers());
  }

  hardBan(user: User): void {
    const reason = prompt(`Why are you banning ${user.username}? They will be signed out and removed from every group.`);
    if (reason === null) return;
    this.run(this.admin.hardBan(user._id, reason), `${user.username} has been banned`, () => this.loadUsers());
  }

  liftBan(user: User): void {
    this.run(this.admin.liftBan(user._id), `${user.username} can sign in again`, () => {
      this.loadUsers();
      this.loadBans();
    });
  }

  // ---- bans ----
  loadBans(): void {
    this.admin.bans().subscribe((b) => {
      this.hardBanned.set(b.hardBanned);
      this.banLog.set(b.log);
    });
  }

  // ---- audit ----
  loadAudit(): void {
    this.admin
      .audit({ type: this.auditType, order: this.auditOrder, from: this.auditFrom, to: this.auditTo })
      .subscribe({
        next: (res) => {
          this.auditTypes.set(res.types);
          this.auditEntries.set(res.entries);
        },
        error: (err) => this.toast.show(errorMessage(err), 'error'),
      });
  }

  signOut(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  private run(req: Observable<unknown>, success: string, done?: () => void): void {
    this.busy.set(true);
    req.subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.show(success, 'success');
        done?.();
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.show(errorMessage(err), 'error', 6000);
      },
    });
  }
}
