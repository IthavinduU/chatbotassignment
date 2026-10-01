import { Routes } from '@angular/router';
import { authGuard, guestGuard, homeRedirect, memberAreaGuard, superGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', canActivate: [homeRedirect], children: [] },

  // Signed-out pages
  { path: 'login', title: 'Sign in | fabulari', canActivate: [guestGuard], loadComponent: () => import('./pages/login/login').then((m) => m.LoginPage) },
  { path: 'register', title: 'Sign up | fabulari', canActivate: [guestGuard], loadComponent: () => import('./pages/register/register').then((m) => m.RegisterPage) },
  { path: 'forgot-password', title: 'Forgot password | fabulari', loadComponent: () => import('./pages/forgot-password/forgot-password').then((m) => m.ForgotPasswordPage) },
  { path: 'reset-password', title: 'Reset password | fabulari', loadComponent: () => import('./pages/reset-password/reset-password').then((m) => m.ResetPasswordPage) },

  // Members and group admins
  {
    path: 'app',
    canActivate: [authGuard, memberAreaGuard],
    loadComponent: () => import('./pages/shell/shell').then((m) => m.ShellPage),
    children: [
      { path: '', title: 'Chatrooms | fabulari', loadComponent: () => import('./pages/home/home').then((m) => m.HomePage) },
      { path: 'groups/:gid/rooms/:cid', title: 'Chat | fabulari', loadComponent: () => import('./pages/room/room').then((m) => m.RoomPage) },
      { path: 'groups/:gid/info', title: 'Group | fabulari', loadComponent: () => import('./pages/group-info/group-info').then((m) => m.GroupInfoPage) },
      { path: 'discover', title: 'Find groups | fabulari', loadComponent: () => import('./pages/discover/discover').then((m) => m.DiscoverPage) },
      { path: 'requests', title: 'My requests | fabulari', loadComponent: () => import('./pages/my-requests/my-requests').then((m) => m.MyRequestsPage) },
      { path: 'incoming', title: 'Requests to review | fabulari', loadComponent: () => import('./pages/incoming/incoming').then((m) => m.IncomingPage) },
      { path: 'profile', title: 'Profile | fabulari', loadComponent: () => import('./pages/profile/profile').then((m) => m.ProfilePage) },
    ],
  },

  // Super admin
  { path: 'admin', title: 'Admin | fabulari', canActivate: [authGuard, superGuard], loadComponent: () => import('./pages/admin/admin').then((m) => m.AdminPage) },

  { path: '**', redirectTo: '' },
];
