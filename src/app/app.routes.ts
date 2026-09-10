import { Routes } from '@angular/router';
import { EmptyStateComponent } from './components/empty-state/empty-state.component';
import { TableViewComponent } from './components/table-view/table-view.component';

export const routes: Routes = [
  {
    path: '',
    component: EmptyStateComponent
  },
  {
    path: 'db/:dbName',
    component: EmptyStateComponent
  },
  {
    path: 'db/:dbName/store/:storeName',
    component: TableViewComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];
