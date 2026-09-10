import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { IndexedDBService } from './core/services/indexeddb.service';
import { ThemeService } from './core/services/theme.service';
import { UiStateService } from './core/services/ui-state.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  readonly idb = inject(IndexedDBService);
  readonly theme = inject(ThemeService);
  readonly ui = inject(UiStateService);
}
