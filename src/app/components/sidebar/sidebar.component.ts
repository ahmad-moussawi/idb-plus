import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IndexedDBService } from '../../core/services/indexeddb.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <aside class="w-64 shrink-0 flex flex-col h-full border-r select-none"
           style="background-color: var(--dt-surface); border-color: var(--dt-border);">
      
      <!-- Top: Database Selector Section -->
      <div class="p-2 border-b flex flex-col gap-1.5" style="border-color: var(--dt-border);">
        <div class="flex items-center justify-between">
          <label class="text-[10px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1"
                 style="color: var(--dt-text-secondary);">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"></ellipse>
              <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path>
              <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path>
            </svg>
            Database
          </label>
          <div class="flex items-center gap-1">
            <button class="dt-icon-btn" title="Refresh Databases" (click)="refreshDatabases()">
              <svg class="w-3.5 h-3.5" [class.animate-spin]="idb.loadingDatabases()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                <path d="M3 3v5h5"></path>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                <path d="M16 21h5v-5"></path>
              </svg>
            </button>
          </div>
        </div>

        <!-- Database Dropdown Select -->
        <div class="relative">
          <select 
            class="w-full dt-select pr-7 text-xs font-medium truncate"
            [ngModel]="idb.activeDatabaseName()"
            (ngModelChange)="onSelectDatabase($event)">
            @if (idb.databases().length === 0) {
              <option value="" disabled>No databases found</option>
            }
            @for (db of idb.databases(); track db.name) {
              <option [value]="db.name">
                {{ db.name }} (v{{ db.version }})
              </option>
            }
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5" style="color: var(--dt-text-secondary);">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>
      </div>

      <!-- Table Filter Search -->
      <div class="p-2 border-b" style="border-color: var(--dt-border);">
        <div class="relative flex items-center">
          <svg class="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--dt-text-secondary);"
               viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input 
            type="text" 
            placeholder="Filter tables..." 
            [(ngModel)]="searchQuery"
            class="w-full dt-input dt-search-input py-1 text-xs" />
          @if (searchQuery()) {
            <button 
              class="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted hover:opacity-100" 
              style="color: var(--dt-text-secondary);"
              (click)="searchQuery.set('')">✕</button>
          }
        </div>
      </div>

      <!-- Object Stores (Tables) List -->
      <div class="flex-1 overflow-y-auto p-1 space-y-0.5">
        <div class="px-2 py-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider"
             style="color: var(--dt-text-secondary);">
          <span>Tables ({{ filteredStores().length }})</span>
        </div>

        @if (idb.loadingStores() && idb.stores().length === 0) {
          <div class="px-3 py-4 text-xs text-center flex items-center justify-center gap-2" style="color: var(--dt-text-secondary);">
            <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10"></path>
            </svg>
            Loading tables...
          </div>
        } @else if (filteredStores().length === 0) {
          <div class="px-3 py-6 text-xs text-center" style="color: var(--dt-text-secondary);">
            @if (searchQuery()) {
              No tables match "{{ searchQuery() }}"
            } @else {
              No object stores in database
            }
          </div>
        } @else {
          @for (store of filteredStores(); track store.name) {
            <button
              type="button"
              (click)="onSelectStore(store.name)"
              class="w-full text-left px-2 py-1.5 rounded flex items-center justify-between group transition-colors text-xs"
              [style.background-color]="store.name === idb.activeStoreName() ? 'var(--dt-row-selected)' : 'transparent'"
              [style.color]="store.name === idb.activeStoreName() ? 'var(--dt-primary)' : 'var(--dt-text)'"
              [class.font-medium]="store.name === idb.activeStoreName()">
              
              <div class="flex items-center gap-2 min-w-0 pr-2">
                <!-- Table Icon -->
                <svg class="w-3.5 h-3.5 shrink-0 opacity-75"
                     [style.color]="store.name === idb.activeStoreName() ? 'var(--dt-primary)' : 'var(--dt-text-secondary)'"
                     viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 3h18v18H3z"></path>
                  <path d="M3 9h18"></path>
                  <path d="M9 21V9"></path>
                </svg>
                
                <span class="truncate">{{ store.name }}</span>
              </div>

              <!-- Metadata Pills: Record Count & Key Info -->
              <div class="flex items-center gap-1 shrink-0">
                @if (store.autoIncrement) {
                  <span class="text-[9px] px-1 rounded uppercase tracking-tighter opacity-75"
                        style="background-color: var(--dt-badge-bg); color: var(--dt-badge-text);"
                        title="Auto-incrementing key">
                    AI
                  </span>
                }
                <span class="dt-pill">
                  {{ store.recordCount ?? 0 }}
                </span>
              </div>
            </button>
          }
        }
      </div>

      <!-- Bottom Status -->
      <div class="p-2 border-t text-[11px] flex items-center justify-between"
           style="border-color: var(--dt-border); color: var(--dt-text-secondary); background-color: var(--dt-surface);">
        <span class="truncate flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full inline-block"
                [style.background-color]="idb.isDevTools() ? 'var(--dt-accent-green)' : 'var(--dt-accent-amber)'"></span>
          {{ idb.isDevTools() ? 'Target Window' : 'Local Sandbox' }}
        </span>
        <span class="text-[10px] font-mono opacity-80">v{{ idb.activeDatabase()?.version || 1 }}</span>
      </div>

    </aside>
  `
})
export class SidebarComponent {
  readonly idb = inject(IndexedDBService);
  private readonly router = inject(Router);

  readonly searchQuery = signal('');

  readonly filteredStores = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.idb.stores();
    if (!q) return list;
    return list.filter(s => s.name.toLowerCase().includes(q));
  });

  async refreshDatabases(): Promise<void> {
    await this.idb.loadDatabases();
  }

  async onSelectDatabase(dbName: string): Promise<void> {
    if (!dbName) return;
    await this.idb.selectDatabase(dbName);
    const firstStore = this.idb.stores()[0]?.name;
    if (firstStore) {
      this.router.navigate(['/db', dbName, 'store', firstStore]);
    } else {
      this.router.navigate(['/db', dbName]);
    }
  }

  onSelectStore(storeName: string): void {
    const dbName = this.idb.activeDatabaseName();
    if (dbName) {
      this.router.navigate(['/db', dbName, 'store', storeName]);
    }
  }
}
