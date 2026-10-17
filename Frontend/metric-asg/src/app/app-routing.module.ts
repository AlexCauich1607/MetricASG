import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component')
        .then(m => m.LoginComponent)
  },
  {
    path: 'sing-up',
    loadComponent: () =>
      import('./pages/sing-up/sing-up.component')
        .then(m => m.SingUpComponent)
  },
  {
    path: '',
    loadChildren: () =>
      import('./pages/pages.routes').then(m => m.pagesRoutes)
  },
  { path: '**', redirectTo: '/home' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
