import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IndexedDBService } from '../../core/services/indexeddb.service';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex-1 flex flex-col items-center justify-center p-8 text-center"
         style="background-color: var(--dt-bg); color: var(--dt-text-secondary);">
      <div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm"
           style="background-color: var(--dt-surface); border: 1px solid var(--dt-border);">
        <svg class="w-8 h-8 text-[var(--dt-primary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
          <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
        </svg>
      </div>

      <h2 class="text-base font-semibold mb-1" style="color: var(--dt-text);">
        @if (idb.activeDatabaseName()) {
          Database: {{ idb.activeDatabaseName() }}
        } @else {
          Welcome to IDB Plus
        }
      </h2>

      <p class="text-xs max-w-sm mb-6 leading-relaxed">
        @if (idb.activeDatabaseName()) {
          Select a table from the left sidebar to browse and inline-edit records, or check database schema and indexes.
        } @else {
          Select a database from the dropdown above to inspect object stores and manipulate data in real time.
        }
      </p>

      <div class="flex items-center gap-3">
        <button class="dt-btn dt-btn-primary" (click)="idb.loadDatabases()">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
            <path d="M3 3v5h5"></path>
          </svg>
          Refresh Databases
        </button>
      </div>
    </div>
  `
})
export class EmptyStateComponent {
  readonly idb = inject(IndexedDBService);
}
