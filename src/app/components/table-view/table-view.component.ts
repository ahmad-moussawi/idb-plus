import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { IndexedDBService } from '../../core/services/indexeddb.service';
import { UiStateService } from '../../core/services/ui-state.service';
import { DataGridComponent } from '../data-grid/data-grid.component';
import { RowDetailComponent } from '../row-detail/row-detail.component';

@Component({
  selector: 'app-table-view',
  standalone: true,
  imports: [CommonModule, DataGridComponent, RowDetailComponent],
  host: {
    class: 'flex-1 min-w-0 flex h-full overflow-hidden'
  },
  template: `
    <div class="flex-1 min-w-0 flex h-full overflow-hidden">
      <!-- Middle: Data Grid -->
      <app-data-grid class="flex-1 min-w-0 flex flex-col h-full overflow-hidden"></app-data-grid>

      <!-- Right: Row Detail Inspector -->
      @if (ui.isRightPanelOpen() && idb.selectedRecord()) {
        <app-row-detail class="h-full flex shrink-0"></app-row-detail>
      }
    </div>
  `
})
export class TableViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly idb = inject(IndexedDBService);
  readonly ui = inject(UiStateService);

  ngOnInit(): void {
    this.route.paramMap.subscribe(async params => {
      const dbName = params.get('dbName');
      const storeName = params.get('storeName');

      if (dbName && dbName !== this.idb.activeDatabaseName()) {
        await this.idb.selectDatabase(dbName);
      }
      if (storeName && storeName !== this.idb.activeStoreName()) {
        await this.idb.selectStore(storeName);
      }
    });
  }
}
