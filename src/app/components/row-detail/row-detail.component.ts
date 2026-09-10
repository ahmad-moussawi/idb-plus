import {
  Component,
  inject,
  signal,
  computed,
  effect
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IndexedDBService } from '../../core/services/indexeddb.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { IDBRecordItem } from '../../core/models/indexeddb.models';

interface FieldEntry {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null';
  isKeyPath: boolean;
}

@Component({
  selector: 'app-row-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  host: {
    class: 'h-full flex shrink-0'
  },
  template: `
    @if (idb.selectedRecord(); as rec) {
      <aside class="w-80 lg:w-96 shrink-0 flex flex-col h-full border-l select-none"
             style="background-color: var(--dt-surface); border-color: var(--dt-border);">
        
        <!-- Header -->
        <div class="h-9 px-2.5 border-b flex items-center justify-between gap-2 shrink-0"
             style="border-color: var(--dt-border); background-color: var(--dt-toolbar-bg);">
          <div class="flex items-center gap-1.5 min-w-0">
            <svg class="w-3.5 h-3.5 text-amber-500 shrink-0" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 14c-1.66 0-3 1.34-3 3 0 1.31.84 2.41 2 2.83V21h2v-1.17c1.16-.42 2-1.52 2-2.83 0-1.66-1.34-3-3-3zm0 4c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm14-8.59l-4.41-4.41a2 2 0 0 0-2.83 0L2.59 16.17a2 2 0 0 0 0 2.83l4.41 4.41a2 2 0 0 0 2.83 0L21 12.24a2 2 0 0 0 0-2.83z"></path>
            </svg>
            <span class="font-mono-code font-bold text-xs truncate" style="color: var(--dt-primary);">
              Key: {{ formatKey(rec.key) }}
            </span>
          </div>

          <div class="flex items-center gap-1 shrink-0">
            <!-- Copy JSON -->
            <button class="dt-icon-btn" title="Copy JSON" (click)="copyJson()">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
            <!-- Delete Row -->
            <button class="dt-icon-btn dt-btn-danger" title="Delete Row" (click)="deleteCurrentRow()">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
            <!-- Close Pane -->
            <button class="dt-icon-btn" title="Close Panel" (click)="closeDetail()">
              ✕
            </button>
          </div>
        </div>

        <!-- View Tabs: Form vs Raw JSON -->
        <div class="px-2 border-b flex items-center gap-1 text-xs shrink-0"
             style="border-color: var(--dt-border); background-color: var(--dt-surface);">
          <button 
            type="button"
            class="px-2.5 py-1 font-medium border-b-2 transition-all flex items-center gap-1.5 text-[11px]"
            [style.border-color]="activeTab() === 'fields' ? 'var(--dt-primary)' : 'transparent'"
            [style.color]="activeTab() === 'fields' ? 'var(--dt-primary)' : 'var(--dt-text-secondary)'"
            (click)="activeTab.set('fields')">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
            Fields
          </button>

          <button 
            type="button"
            class="px-2.5 py-1 font-medium border-b-2 transition-all flex items-center gap-1.5 text-[11px]"
            [style.border-color]="activeTab() === 'json' ? 'var(--dt-primary)' : 'transparent'"
            [style.color]="activeTab() === 'json' ? 'var(--dt-primary)' : 'var(--dt-text-secondary)'"
            (click)="switchToRawJson()">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="16 18 22 12 16 6"></polyline>
              <polyline points="8 6 2 12 8 18"></polyline>
            </svg>
            Raw JSON
          </button>
        </div>

        <!-- Tab 1: Fields View (Full-Width Borderless List) -->
        @if (activeTab() === 'fields') {
          <div class="flex-1 overflow-y-auto divide-y"
               style="background-color: var(--dt-bg);">
            @for (field of fields(); track field.key) {
              <div class="flex flex-col gap-1 px-3 py-2 hover:bg-black/[0.015] dark:hover:bg-white/[0.015] transition-colors"
                   style="border-color: var(--dt-border-subtle);">
                
                <div class="flex items-center justify-between leading-none">
                  <div class="flex items-center gap-1.5 min-w-0">
                    <span class="font-mono-code text-[11px] font-semibold truncate" style="color: var(--dt-text);">
                      {{ field.key }}
                    </span>
                    @if (field.isKeyPath) {
                      <span class="text-[8px] px-1 py-0 rounded uppercase font-bold text-amber-500 bg-amber-500/10">PK</span>
                    }
                  </div>

                  <!-- Type Badge -->
                  <span class="text-[9px] px-1 py-0.5 rounded font-mono uppercase"
                        [style.background-color]="'var(--dt-badge-bg)'"
                        [style.color]="getTypeBadgeColor(field.type)">
                    {{ field.type }}
                  </span>
                </div>

                <!-- Input according to type -->
                @if (field.type === 'boolean') {
                  <label class="inline-flex items-center gap-1.5 cursor-pointer py-0.5 text-[11px]">
                    <input 
                      type="checkbox" 
                      [checked]="field.value"
                      (change)="updateFieldBoolean(field.key, $event)"
                      class="rounded accent-[var(--dt-primary)] w-3.5 h-3.5" />
                    <span [style.color]="field.value ? 'var(--dt-accent-green)' : 'var(--dt-accent-red)'" class="font-mono-code text-[11px]">
                      {{ field.value ? 'true' : 'false' }}
                    </span>
                  </label>
                } @else if (field.type === 'object' || field.type === 'array') {
                  <textarea 
                    rows="2"
                    class="dt-input font-mono-code text-[10px] w-full resize-y p-1.5 leading-tight"
                    [value]="formatJsonField(field.value)"
                    (blur)="updateFieldJson(field.key, $event)"></textarea>
                } @else {
                  <input 
                    type="text" 
                    class="dt-input font-mono-code text-[11px] w-full py-0.5 px-1.5 h-6"
                    [value]="field.value ?? ''"
                    [disabled]="field.isKeyPath && idb.activeStore()?.autoIncrement"
                    (blur)="updateFieldPrimitive(field.key, field.type, $event)" />
                }
              </div>
            }
          </div>
        }

        <!-- Tab 2: Raw JSON View -->
        @if (activeTab() === 'json') {
          <div class="flex-1 overflow-hidden flex flex-col p-2 gap-1.5">
            <div class="flex items-center justify-between text-xs">
              <span class="text-muted text-[11px]" style="color: var(--dt-text-secondary);">Direct JSON Editor</span>
              <button class="text-[10px] underline" style="color: var(--dt-primary);" (click)="formatRawJson()">
                Beautify / Validate
              </button>
            </div>
            <textarea 
              [(ngModel)]="rawJsonText"
              (input)="onJsonInput()"
              class="flex-1 dt-input font-mono-code text-[11px] p-2 resize-none leading-relaxed"
              style="background-color: var(--dt-code-bg);"
              spellcheck="false"></textarea>
            
            @if (jsonError()) {
              <p class="text-[10px] text-red-500 font-mono">{{ jsonError() }}</p>
            }
          </div>
        }

        <!-- Footer Actions -->
        <div class="px-2.5 py-1.5 border-t flex items-center justify-between gap-2 shrink-0"
             style="border-color: var(--dt-border); background-color: var(--dt-toolbar-bg);">
          
          <button class="dt-btn py-0.5 px-2 text-xs" (click)="duplicateRecord()" title="Duplicate Record">
            <svg class="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            Duplicate
          </button>

          <div class="flex items-center gap-2">
            @if (isDirty()) {
              <span class="text-[10px] text-amber-500 font-medium">● Unsaved</span>
            }
            <button 
              class="dt-btn dt-btn-primary py-0.5 px-2.5 text-xs" 
              [disabled]="!isDirty() || !!jsonError()" 
              (click)="saveChanges()">
              Save Changes
            </button>
          </div>

        </div>

      </aside>
    }
  `
})
export class RowDetailComponent {
  readonly idb = inject(IndexedDBService);
  readonly ui = inject(UiStateService);

  readonly activeTab = signal<'fields' | 'json'>('fields');
  readonly isDirty = signal<boolean>(false);
  readonly jsonError = signal<string | null>(null);

  rawJsonText = '';
  private currentEditedValue: any = null;

  constructor() {
    // Whenever selected record changes, synchronize local state
    effect(() => {
      const rec = this.idb.selectedRecord();
      if (rec) {
        this.currentEditedValue = JSON.parse(JSON.stringify(rec.value));
        this.rawJsonText = JSON.stringify(this.currentEditedValue, null, 2);
        this.isDirty.set(false);
        this.jsonError.set(null);
      }
    });
  }

  readonly fields = computed<FieldEntry[]>(() => {
    const rec = this.idb.selectedRecord();
    if (!rec) return [];

    const store = this.idb.activeStore();
    const val = this.currentEditedValue;
    const keyPath = store?.keyPath;

    if (val && typeof val === 'object' && !Array.isArray(val)) {
      return Object.keys(val).map(key => {
        const itemVal = val[key];
        let type: FieldEntry['type'] = 'string';
        if (itemVal === null) type = 'null';
        else if (Array.isArray(itemVal)) type = 'array';
        else if (typeof itemVal === 'number') type = 'number';
        else if (typeof itemVal === 'boolean') type = 'boolean';
        else if (typeof itemVal === 'object') type = 'object';

        const isKeyPath = keyPath === key || (Array.isArray(keyPath) && keyPath.includes(key));
        return { key, value: itemVal, type, isKeyPath };
      });
    }

    return [{
      key: 'value',
      value: val,
      type: typeof val as any,
      isKeyPath: false
    }];
  });

  formatKey(key: any): string {
    if (typeof key === 'object') return JSON.stringify(key);
    return String(key);
  }

  getTypeBadgeColor(type: string): string {
    switch (type) {
      case 'string': return 'var(--dt-accent-green)';
      case 'number': return 'var(--dt-primary)';
      case 'boolean': return 'var(--dt-accent-amber)';
      case 'array': return '#a78bfa';
      case 'object': return '#f472b6';
      default: return 'var(--dt-text-tertiary)';
    }
  }

  formatJsonField(val: any): string {
    try {
      return JSON.stringify(val, null, 2);
    } catch {
      return String(val);
    }
  }

  updateFieldBoolean(key: string, e: Event): void {
    const checked = (e.target as HTMLInputElement).checked;
    this.currentEditedValue = { ...this.currentEditedValue, [key]: checked };
    this.rawJsonText = JSON.stringify(this.currentEditedValue, null, 2);
    this.isDirty.set(true);
  }

  updateFieldPrimitive(key: string, type: string, e: Event): void {
    const str = (e.target as HTMLInputElement).value;
    let finalVal: any = str;
    if (type === 'number') {
      const n = Number(str);
      finalVal = isNaN(n) ? str : n;
    }
    this.currentEditedValue = { ...this.currentEditedValue, [key]: finalVal };
    this.rawJsonText = JSON.stringify(this.currentEditedValue, null, 2);
    this.isDirty.set(true);
  }

  updateFieldJson(key: string, e: Event): void {
    const text = (e.target as HTMLTextAreaElement).value;
    try {
      const parsed = JSON.parse(text);
      this.currentEditedValue = { ...this.currentEditedValue, [key]: parsed };
      this.rawJsonText = JSON.stringify(this.currentEditedValue, null, 2);
      this.isDirty.set(true);
    } catch {
      // Invalid JSON, leave as text
    }
  }

  switchToRawJson(): void {
    this.rawJsonText = JSON.stringify(this.currentEditedValue, null, 2);
    this.activeTab.set('json');
  }

  onJsonInput(): void {
    this.isDirty.set(true);
    try {
      this.currentEditedValue = JSON.parse(this.rawJsonText);
      this.jsonError.set(null);
    } catch (e: any) {
      this.jsonError.set(`Syntax error: ${e.message}`);
    }
  }

  formatRawJson(): void {
    try {
      const parsed = JSON.parse(this.rawJsonText);
      this.rawJsonText = JSON.stringify(parsed, null, 2);
      this.currentEditedValue = parsed;
      this.jsonError.set(null);
    } catch (e: any) {
      this.jsonError.set(`Syntax error: ${e.message}`);
    }
  }

  async saveChanges(): Promise<void> {
    const rec = this.idb.selectedRecord();
    if (!rec || !this.currentEditedValue) return;

    if (this.jsonError()) return;

    const success = await this.idb.updateRecord(rec.key, this.currentEditedValue);
    if (success) {
      this.isDirty.set(false);
    }
  }

  async duplicateRecord(): Promise<void> {
    const rec = this.idb.selectedRecord();
    if (!rec) return;

    const store = this.idb.activeStore();
    const copy = JSON.parse(JSON.stringify(this.currentEditedValue));

    let key: any = undefined;
    if (store?.keyPath) {
      // If store is auto-increment, omit or increment keyPath
      if (store.autoIncrement && typeof store.keyPath === 'string') {
        delete copy[store.keyPath];
      } else if (typeof store.keyPath === 'string') {
        copy[store.keyPath] = `${copy[store.keyPath]}_copy_${Date.now()}`;
      }
    } else {
      key = `${rec.key}_copy_${Date.now()}`;
    }

    await this.idb.addRecord(copy, key);
  }

  async deleteCurrentRow(): Promise<void> {
    const rec = this.idb.selectedRecord();
    if (!rec) return;

    if (confirm(`Delete record with key "${this.formatKey(rec.key)}"?`)) {
      await this.idb.deleteRecord(rec.key);
      this.idb.selectRecord(null);
    }
  }

  copyJson(): void {
    navigator.clipboard.writeText(this.rawJsonText);
  }

  closeDetail(): void {
    this.ui.closeRightPanel();
  }
}
