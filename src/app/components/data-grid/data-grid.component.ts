import {
  Component,
  inject,
  signal,
  computed,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IndexedDBService } from '../../core/services/indexeddb.service';
import { IDBRecordItem } from '../../core/models/indexeddb.models';

interface EditingCell {
  rowKey: string;
  column: string;
  value: any;
  originalValue: any;
}

@Component({
  selector: 'app-data-grid',
  standalone: true,
  imports: [CommonModule, FormsModule],
  host: {
    class: 'flex-1 min-w-0 flex flex-col h-full overflow-hidden'
  },
  template: `
    <div class="flex-1 min-w-0 flex flex-col h-full overflow-hidden"
         style="background-color: var(--dt-bg);">
      
      <!-- Top Grid Toolbar -->
      <div class="px-3 py-2 border-b flex items-center justify-between gap-3 shrink-0"
           style="border-color: var(--dt-border); background-color: var(--dt-toolbar-bg);">
        
        <!-- Left: Table Name & Meta Pills -->
        <div class="flex items-center gap-2 min-w-0">
          <div class="flex items-center gap-1.5 font-semibold text-xs truncate">
            <span style="color: var(--dt-text-secondary);">{{ idb.activeDatabaseName() }}</span>
            <span style="color: var(--dt-border);">/</span>
            <span style="color: var(--dt-text);" class="font-bold">{{ idb.activeStoreName() }}</span>
          </div>

          @if (idb.activeStore(); as store) {
            <div class="flex items-center gap-1 shrink-0">
              @if (store.keyPath) {
                <span class="dt-pill text-[10px]" title="Primary Key Path">
                  pk: {{ formatKeyPath(store.keyPath) }}
                </span>
              } @else {
                <span class="dt-pill text-[10px]" title="Out-of-line keys">
                  out-of-line key
                </span>
              }
              @if (store.indexes.length > 0) {
                <span class="dt-pill text-[10px]" title="Indexes available">
                  {{ store.indexes.length }} idx
                </span>
              }
            </div>
          }
        </div>

        <!-- Right Toolbar Actions -->
        <div class="flex items-center gap-2">
          <!-- Filter Search -->
          <div class="relative flex items-center">
            <svg class="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style="color: var(--dt-text-secondary);"
                 viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input 
              type="text" 
              placeholder="Filter rows..." 
              [ngModel]="idb.filterQuery()"
              (ngModelChange)="onSearchChange($event)"
              class="dt-input dt-search-input py-1 text-xs w-36 lg:w-48" />
            @if (idb.filterQuery()) {
              <button 
                class="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-muted hover:opacity-100" 
                style="color: var(--dt-text-secondary);"
                (click)="onSearchChange('')">✕</button>
            }
          </div>

          <!-- Add Record Button -->
          <button class="dt-btn dt-btn-primary" (click)="openAddModal()" title="Add Record">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            Add Record
          </button>

          <!-- Refresh Data -->
          <button class="dt-icon-btn" title="Refresh Table" (click)="refresh()">
            <svg class="w-3.5 h-3.5" [class.animate-spin]="idb.loading()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
              <path d="M3 3v5h5"></path>
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
              <path d="M16 21h5v-5"></path>
            </svg>
          </button>

          <!-- Clear Table -->
          <button class="dt-icon-btn dt-btn-danger" title="Clear Store" (click)="confirmClearStore()">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>

      <!-- Table Body Container -->
      <div class="flex-1 overflow-auto relative">
        @if (idb.loading() && idb.records().length === 0) {
          <div class="absolute inset-0 flex items-center justify-center gap-2" style="color: var(--dt-text-secondary);">
            <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
              <path d="M12 2a10 10 0 0 1 10 10"></path>
            </svg>
            Loading records...
          </div>
        } @else if (idb.records().length === 0) {
          <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6"
               style="color: var(--dt-text-secondary);">
            <svg class="w-8 h-8 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            <span class="text-sm font-medium">No records found</span>
            <span class="text-xs max-w-sm">
              @if (idb.filterQuery()) {
                No records match your filter criteria. Try clearing the filter.
              } @else {
                This table is empty. Click "+ Add Record" above to create the first record.
              }
            </span>
          </div>
        } @else {
          <!-- Table Grid -->
          <table class="w-full border-collapse text-left border-b font-mono-code text-[11px]"
                 style="border-color: var(--dt-border);">
            
            <!-- Sticky Header -->
            <thead class="sticky top-0 z-10 select-none shadow-sm"
                   style="background-color: var(--dt-header-bg); color: var(--dt-text-secondary);">
              <tr class="border-b" style="border-color: var(--dt-border);">
                <!-- Row # Column Header -->
                <th class="py-1.5 px-2.5 w-12 font-medium border-r text-center text-[10px]"
                    style="border-color: var(--dt-border); color: var(--dt-text-tertiary);">
                  #
                </th>

                <!-- Primary Key Indicator Header -->
                <th class="py-1.5 px-3 font-semibold border-r min-w-[90px] whitespace-nowrap"
                    style="border-color: var(--dt-border); color: var(--dt-text);">
                  <div class="flex items-center gap-1">
                    <svg class="w-3 h-3 text-amber-500" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31.84 2.41 2 2.83V21h2v-1.17c1.16-.42 2-1.52 2-2.83 0-1.66-1.34-3-3-3zm0 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm14-8.59l-4.41-4.41a2 2 0 0 0-2.83 0L2.59 16.17a2 2 0 0 0 0 2.83l4.41 4.41a2 2 0 0 0 2.83 0L21 12.24a2 2 0 0 0 0-2.83z"></path>
                    </svg>
                    <span>Key</span>
                  </div>
                </th>

                <!-- Dynamic Record Column Headers -->
                @for (col of idb.columns(); track col) {
                  <th class="py-1.5 px-3 font-semibold border-r min-w-[120px] max-w-[240px] truncate"
                      style="border-color: var(--dt-border); color: var(--dt-text);"
                      [title]="col">
                    {{ col }}
                  </th>
                }
              </tr>
            </thead>

            <!-- Table Rows -->
            <tbody>
              @for (item of idb.records(); track getRowKey(item)) {
                <tr 
                  (click)="onSelectRow(item)"
                  class="border-b transition-colors cursor-pointer group"
                  [style.border-color]="'var(--dt-border-subtle)'"
                  [style.background-color]="isRowSelected(item) ? 'var(--dt-row-selected)' : 'transparent'"
                  [class.hover:bg-[var(--dt-row-hover)]]="!isRowSelected(item)">
                  
                  <!-- Row Number -->
                  <td class="py-1.5 px-2.5 text-center border-r select-none text-[10px]"
                      style="border-color: var(--dt-border); color: var(--dt-text-tertiary);">
                    {{ item._rowNum }}
                  </td>

                  <!-- Primary Key Cell -->
                  <td class="py-1.5 px-3 border-r font-medium truncate max-w-[140px]"
                      style="border-color: var(--dt-border); color: var(--dt-primary);"
                      [title]="formatCellVal(item.key)">
                    {{ formatCellVal(item.key) }}
                  </td>

                  <!-- Dynamic Field Cells (Double click to inline edit) -->
                  @for (col of idb.columns(); track col) {
                    <td 
                      class="py-1 px-3 border-r max-w-[240px] truncate relative"
                      style="border-color: var(--dt-border);"
                      [class.bg-[var(--dt-cell-editing)]]="isCellEditing(item, col)"
                      (dblclick)="startEditCell(item, col, $event)">
                      
                      @if (isCellEditing(item, col)) {
                        <!-- Inline Edit Input -->
                        <div class="flex items-center gap-1 -my-1 -mx-2">
                          <input 
                            #inlineInput
                            type="text"
                            [ngModel]="editingCell()?.value"
                            (ngModelChange)="updateEditingValue($event)"
                            (keydown.enter)="commitEdit()"
                            (keydown.escape)="cancelEdit()"
                            (blur)="commitEdit()"
                            class="w-full bg-white dark:bg-black px-2 py-0.5 border border-[var(--dt-primary)] rounded-xs outline-none text-[11px] font-mono-code text-[var(--dt-text)]" />
                        </div>
                      } @else {
                        <!-- Cell View Mode -->
                        <div class="flex items-center justify-between group/cell">
                          <span class="truncate" [title]="formatCellVal(getCellValue(item, col))">
                            @if (isComplexType(getCellValue(item, col))) {
                              <span class="px-1.5 py-0.2 rounded text-[10px] opacity-75 font-sans"
                                    style="background-color: var(--dt-badge-bg); color: var(--dt-badge-text);">
                                {{ formatComplexBadge(getCellValue(item, col)) }}
                              </span>
                            } @else if (getCellValue(item, col) === null || getCellValue(item, col) === undefined) {
                              <span class="italic text-[10px] opacity-40">null</span>
                            } @else if (isBoolean(getCellValue(item, col))) {
                              <span [style.color]="getCellValue(item, col) ? 'var(--dt-accent-green)' : 'var(--dt-accent-red)'">
                                {{ getCellValue(item, col) }}
                              </span>
                            } @else {
                              <span>{{ formatCellVal(getCellValue(item, col)) }}</span>
                            }
                          </span>

                          <!-- Hover inline edit pencil trigger -->
                          <button 
                            type="button"
                            (click)="startEditCell(item, col, $event)"
                            class="opacity-0 group-hover/cell:opacity-100 p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10 shrink-0 ml-1"
                            title="Edit cell (Double click)">
                            <svg class="w-2.5 h-2.5 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M12 20h9"></path>
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                            </svg>
                          </button>
                        </div>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        }
      </div>

      <!-- Bottom Pagination Bar -->
      <div class="px-3 py-1.5 border-t flex items-center justify-between shrink-0 select-none text-xs"
           style="border-color: var(--dt-border); background-color: var(--dt-surface); color: var(--dt-text-secondary);">
        
        <!-- Left: Record range info -->
        <div class="flex items-center gap-2">
          <span>
            Showing 
            <strong style="color: var(--dt-text);">{{ rangeStart() }} - {{ rangeEnd() }}</strong> 
            of 
            <strong style="color: var(--dt-text);">{{ idb.pagination().total }}</strong> records
          </span>

          <!-- Page size selector -->
          <div class="flex items-center gap-1 ml-3 pl-3 border-l" style="border-color: var(--dt-border);">
            <span class="text-[11px]">Rows:</span>
            <select 
              class="dt-select text-[11px] py-0.5 px-1.5"
              [ngModel]="idb.pagination().pageSize"
              (ngModelChange)="onPageSizeChange($event)">
              <option [value]="10">10</option>
              <option [value]="25">25</option>
              <option [value]="50">50</option>
              <option [value]="100">100</option>
            </select>
          </div>
        </div>

        <!-- Right: Pagination Buttons -->
        <div class="flex items-center gap-1">
          <button 
            class="dt-btn px-2 py-0.5 text-xs"
            [disabled]="idb.pagination().page <= 1"
            (click)="idb.setPage(1)"
            title="First Page">
            «
          </button>
          <button 
            class="dt-btn px-2 py-0.5 text-xs"
            [disabled]="idb.pagination().page <= 1"
            (click)="idb.setPage(idb.pagination().page - 1)"
            title="Previous Page">
            ‹
          </button>

          <span class="px-2 py-0.5 text-xs font-medium" style="color: var(--dt-text);">
            Page {{ idb.pagination().page }} of {{ idb.pagination().totalPages }}
          </span>

          <button 
            class="dt-btn px-2 py-0.5 text-xs"
            [disabled]="idb.pagination().page >= idb.pagination().totalPages"
            (click)="idb.setPage(idb.pagination().page + 1)"
            title="Next Page">
            ›
          </button>
          <button 
            class="dt-btn px-2 py-0.5 text-xs"
            [disabled]="idb.pagination().page >= idb.pagination().totalPages"
            (click)="idb.setPage(idb.pagination().totalPages)"
            title="Last Page">
            »
          </button>
        </div>

      </div>

      <!-- Add Record Modal -->
      @if (showAddModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div class="w-full max-w-lg rounded-lg shadow-2xl flex flex-col border overflow-hidden"
               style="background-color: var(--dt-bg); border-color: var(--dt-border);">
            <div class="px-4 py-3 border-b flex items-center justify-between"
                 style="border-color: var(--dt-border); background-color: var(--dt-surface);">
              <h3 class="text-sm font-semibold flex items-center gap-2" style="color: var(--dt-text);">
                <svg class="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"></path>
                </svg>
                Add New Record to {{ idb.activeStoreName() }}
              </h3>
              <button class="text-muted hover:opacity-100" (click)="showAddModal.set(false)">✕</button>
            </div>

            <div class="p-4 flex flex-col gap-3">
              @if (idb.activeStore() && !idb.activeStore()?.keyPath) {
                <div>
                  <label class="block text-xs font-medium mb-1" style="color: var(--dt-text);">
                    Key (Out-of-line primary key):
                  </label>
                  <input type="text" [(ngModel)]="newRecordKey" placeholder="e.g. user_session_123 or 42" class="dt-input w-full py-1 text-xs" />
                </div>
              }

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-xs font-medium" style="color: var(--dt-text);">
                    JSON Payload:
                  </label>
                  <button type="button" class="text-[11px] underline opacity-80 hover:opacity-100" style="color: var(--dt-primary);" (click)="formatJsonTemplate()">
                    Format / Pre-fill Template
                  </button>
                </div>
                <textarea 
                  [(ngModel)]="newRecordJson"
                  rows="10"
                  class="w-full dt-input font-mono-code text-xs p-2.5 resize-y outline-none"
                  placeholder='{\n  "name": "Example",\n  "active": true\n}'>
                </textarea>
                @if (addError()) {
                  <p class="text-xs text-red-500 mt-1">{{ addError() }}</p>
                }
              </div>
            </div>

            <div class="px-4 py-3 border-t flex items-center justify-end gap-2"
                 style="border-color: var(--dt-border); background-color: var(--dt-surface);">
              <button class="dt-btn" (click)="showAddModal.set(false)">Cancel</button>
              <button class="dt-btn dt-btn-primary" (click)="submitAddRecord()">Save Record</button>
            </div>
          </div>
        </div>
      }

    </div>
  `
})
export class DataGridComponent {
  readonly idb = inject(IndexedDBService);

  @ViewChild('inlineInput') inlineInputRef?: ElementRef<HTMLInputElement>;

  readonly editingCell = signal<EditingCell | null>(null);
  readonly showAddModal = signal<boolean>(false);
  readonly addError = signal<string | null>(null);
  newRecordKey = '';
  newRecordJson = '{\n  \n}';

  readonly rangeStart = computed(() => {
    const p = this.idb.pagination();
    if (p.total === 0) return 0;
    return (p.page - 1) * p.pageSize + 1;
  });

  readonly rangeEnd = computed(() => {
    const p = this.idb.pagination();
    return Math.min(p.page * p.pageSize, p.total);
  });

  formatKeyPath(kp: string | string[]): string {
    return Array.isArray(kp) ? kp.join(', ') : kp;
  }

  getRowKey(item: IDBRecordItem): string {
    return JSON.stringify(item.key);
  }

  isRowSelected(item: IDBRecordItem): boolean {
    const sel = this.idb.selectedRecord();
    if (!sel) return false;
    return JSON.stringify(sel.key) === JSON.stringify(item.key);
  }

  onSelectRow(item: IDBRecordItem): void {
    this.idb.selectRecord(item);
  }

  getCellValue(item: IDBRecordItem, column: string): any {
    if (column === '__key') return item.key;
    if (item.value && typeof item.value === 'object') {
      return item.value[column];
    }
    return item.value;
  }

  isBoolean(val: any): boolean {
    return typeof val === 'boolean';
  }

  isComplexType(val: any): boolean {
    return val !== null && typeof val === 'object';
  }

  formatComplexBadge(val: any): string {
    if (Array.isArray(val)) return `[${val.length} items]`;
    if (val && typeof val === 'object') return `{${Object.keys(val).length} keys}`;
    return String(val);
  }

  formatCellVal(val: any): string {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  // -------------------------------------------------------------
  // Inline Editing
  // -------------------------------------------------------------

  isCellEditing(item: IDBRecordItem, column: string): boolean {
    const cur = this.editingCell();
    if (!cur) return false;
    return cur.rowKey === this.getRowKey(item) && cur.column === column;
  }

  startEditCell(item: IDBRecordItem, column: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    // Cannot directly edit primary key if it's auto-generated / keyPath
    const store = this.idb.activeStore();
    if (store?.keyPath === column && store.autoIncrement) {
      return;
    }

    const currentVal = this.getCellValue(item, column);
    this.editingCell.set({
      rowKey: this.getRowKey(item),
      column: column,
      value: typeof currentVal === 'object' ? JSON.stringify(currentVal) : currentVal,
      originalValue: currentVal
    });

    // Auto-focus the input on next tick
    setTimeout(() => {
      this.inlineInputRef?.nativeElement?.focus();
      this.inlineInputRef?.nativeElement?.select();
    }, 20);
  }

  updateEditingValue(val: any): void {
    const cur = this.editingCell();
    if (cur) {
      this.editingCell.set({ ...cur, value: val });
    }
  }

  async commitEdit(): Promise<void> {
    const cur = this.editingCell();
    if (!cur) return;

    this.editingCell.set(null);

    // Find the record
    const record = this.idb.records().find(r => this.getRowKey(r) === cur.rowKey);
    if (!record) return;

    let parsedVal = cur.value;
    const origType = typeof cur.originalValue;

    // Convert string back to original type
    if (origType === 'number') {
      const num = Number(cur.value);
      if (!isNaN(num)) parsedVal = num;
    } else if (origType === 'boolean') {
      parsedVal = cur.value === 'true' || cur.value === true;
    } else if (origType === 'object' && cur.originalValue !== null) {
      try {
        parsedVal = JSON.parse(cur.value);
      } catch {
        parsedVal = cur.value;
      }
    }

    // Prepare updated value object
    let updatedPayload: any;
    if (record.value && typeof record.value === 'object' && !Array.isArray(record.value)) {
      updatedPayload = { ...record.value, [cur.column]: parsedVal };
    } else {
      updatedPayload = parsedVal;
    }

    await this.idb.updateRecord(record.key, updatedPayload);
  }

  cancelEdit(): void {
    this.editingCell.set(null);
  }

  // -------------------------------------------------------------
  // Toolbar Actions & Modals
  // -------------------------------------------------------------

  async refresh(): Promise<void> {
    await this.idb.refreshCurrentStore();
  }

  onSearchChange(text: string): void {
    this.idb.setFilter(text);
  }

  onPageSizeChange(size: number): void {
    this.idb.setPageSize(Number(size));
  }

  async confirmClearStore(): Promise<void> {
    const store = this.idb.activeStoreName();
    if (!store) return;
    if (confirm(`Are you sure you want to clear all records from "${store}"? This cannot be undone.`)) {
      await this.idb.clearStore();
    }
  }

  openAddModal(): void {
    const store = this.idb.activeStore();
    const cols = this.idb.columns().filter(c => c !== '__key' && c !== store?.keyPath);
    const templateObj: any = {};
    cols.forEach(c => { templateObj[c] = ''; });

    this.newRecordKey = '';
    this.newRecordJson = JSON.stringify(templateObj, null, 2);
    this.addError.set(null);
    this.showAddModal.set(true);
  }

  formatJsonTemplate(): void {
    try {
      const parsed = JSON.parse(this.newRecordJson);
      this.newRecordJson = JSON.stringify(parsed, null, 2);
      this.addError.set(null);
    } catch (e: any) {
      this.addError.set(`Invalid JSON: ${e.message}`);
    }
  }

  async submitAddRecord(): Promise<void> {
    this.addError.set(null);
    let payload: any;
    try {
      payload = JSON.parse(this.newRecordJson);
    } catch (e: any) {
      this.addError.set(`Invalid JSON: ${e.message}`);
      return;
    }

    const store = this.idb.activeStore();
    let key: any = undefined;

    if (store && !store.keyPath) {
      if (!this.newRecordKey) {
        this.addError.set('Key is required for out-of-line store');
        return;
      }
      key = isNaN(Number(this.newRecordKey)) ? this.newRecordKey : Number(this.newRecordKey);
    }

    const success = await this.idb.addRecord(payload, key);
    if (success) {
      this.showAddModal.set(false);
    }
  }
}
