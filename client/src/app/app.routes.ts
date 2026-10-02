import { Routes } from '@angular/router';
import { authGuard, bootstrapPageGuard, guestGuard, homeRedirect, memberAreaGuard, setupGuard, superGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [homeRedirect], children: [] },

  { path: 'bootstrap', title: 'Set up | Fabulari', canActivate: [bootstrapPageGuard], loadComponent: () => import('./pages/bootstrap/bootstrap').then((m) => m.BootstrapPage) },

  { path: 'login', title: 'Sign in | Fabulari', canActivate: [guestGuard, setupGuard], loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage) },
  { path: 'register', title: 'Sign up | Fabulari', canActivate: [guestGuard, setupGuard], loadComponent: () => import('./pages/register/register').then((m) => m.RegisterPage) },
  { path: 'forgot-password', title: 'Forgot password | Fabulari', loadComponent: () => import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPasswordPage) },
  { path: 'reset-password', title: 'Reset password | Fabulari', loadComponent: () => import('./pages/reset-password/reset-password').then((m) => m.ResetPasswordPage) },

  {
    path: 'app',
    canActivate: [authGuard, memberAreaGuard],
    loadComponent: () => import('./pages/shell/shell').then((m) => m.ShellPage),
    children: [
      { path: '', title: 'Chatrooms | Fabulari', loadComponent: () => import('./pages/home/home').then((m) => m.HomePage) },
      { path: 'groups/:gid/rooms/:cid', title: 'Chat | Fabulari', loadComponent: () => import('./pages/room/room').then((m) => m.RoomPage) },
      { path: 'groups/:gid/info', title: 'Group | Fabulari', loadComponent: () => import('./pages/group-info/group-info').then((m) => m.GroupInfoPage) },
      { path: 'discover', title: 'Find groups | Fabulari', loadComponent: () => import('./pages/discover/discover').then((m) => m.DiscoverPage) },
      { path: 'requests', title: 'My requests | Fabulari', loadComponent: () => import('./pages/my-requests/my-requests').then((m) => m.MyRequestsPage) },
      { path: 'incoming', title: 'Requests to review | Fabulari', loadComponent: () => import('./pages/incoming/incoming').then((m) => m.IncomingPage) },
      { path: 'profile', title: 'Profile | Fabulari', loadComponent: () => import('./pages/profile/profile').then((m) => m.ProfilePage) },
    ],
  },

  { path: 'admin', title: 'Admin | Fabulari', canActivate: [authGuard, superGuard], loadComponent: () => import('./pages/admin/admin').then((m) => m.AdminPage) },

  { path: '**', redirectTo: '' },
];