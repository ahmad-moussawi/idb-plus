export interface IDBDatabaseMeta {
  name: string;
  version: number;
}

export interface IDBIndexMeta {
  name: string;
  keyPath: string | string[];
  unique: boolean;
  multiEntry: boolean;
}

export interface IDBStoreMeta {
  name: string;
  keyPath: string | string[] | null;
  autoIncrement: boolean;
  indexes: IDBIndexMeta[];
  recordCount?: number;
}

export interface IDBRecordItem {
  key: any;
  primaryKey?: any;
  value: any;
  _rowNum: number;
  _isModified?: boolean;
  _originalValue?: any;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface QueryOptions {
  page: number;
  pageSize: number;
  filterText?: string;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface CellEditEvent {
  record: IDBRecordItem;
  column: string;
  oldValue: any;
  newValue: any;
}
