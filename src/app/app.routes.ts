import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./features/ia/pages/ia-dashboard/ia-dashboard').then((m) => m.IADashboard),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
