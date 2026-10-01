import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from './components/toast-container';
import { AuthService } from './services/auth.service';
import { SocketService } from './services/socket.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer],
  template: `<router-outlet /><app-toasts />`,
})
export class App implements OnInit {
  private readonly auth = inject(AuthService);

  constructor() {
    inject(SocketService); // start the socket connection as soon as someone is signed in
  }

  ngOnInit(): void {
    if (this.auth.isLoggedIn()) this.auth.refreshMe().subscribe({ error: () => {} });
  }
}
