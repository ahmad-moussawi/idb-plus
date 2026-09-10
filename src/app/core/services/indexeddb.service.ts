import { Injectable, signal, computed } from '@angular/core';
import {
  IDBDatabaseMeta,
  IDBStoreMeta,
  IDBRecordItem,
  PaginationState,
  QueryOptions
} from '../models/indexeddb.models';

@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  // Signals
  readonly databases = signal<IDBDatabaseMeta[]>([]);
  readonly activeDatabaseName = signal<string | null>(null);
  readonly stores = signal<IDBStoreMeta[]>([]);
  readonly activeStoreName = signal<string | null>(null);

  readonly records = signal<IDBRecordItem[]>([]);
  readonly selectedRecord = signal<IDBRecordItem | null>(null);
  readonly filterQuery = signal<string>('');
  readonly sortColumn = signal<string | null>(null);
  readonly sortDirection = signal<'asc' | 'desc'>('asc');

  readonly pagination = signal<PaginationState>({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1
  });

  readonly loadingRecords = signal<boolean>(false);
  readonly loadingStores = signal<boolean>(false);
  readonly loadingDatabases = signal<boolean>(false);
  readonly loading = this.loadingRecords;
  readonly error = signal<string | null>(null);
  readonly isDevTools = signal<boolean>(false);

  // Computed
  readonly activeStore = computed(() => {
    const current = this.activeStoreName();
    if (!current) return null;
    return this.stores().find(s => s.name === current) || null;
  });

  readonly activeDatabase = computed(() => {
    const current = this.activeDatabaseName();
    if (!current) return null;
    return this.databases().find(d => d.name === current) || null;
  });

  // Dynamic column headers derived from records
  readonly columns = computed(() => {
    const recs = this.records();
    const colsSet = new Set<string>();

    const store = this.activeStore();
    if (store && !store.keyPath) {
      colsSet.add('__key');
    }

    for (const rec of recs) {
      if (rec.value && typeof rec.value === 'object' && !Array.isArray(rec.value)) {
        Object.keys(rec.value).forEach(k => colsSet.add(k));
      } else {
        colsSet.add('value');
      }
    }

    const arr = Array.from(colsSet);
    if (store?.keyPath) {
      const kp = Array.isArray(store.keyPath) ? store.keyPath[0] : store.keyPath;
      const idx = arr.indexOf(kp);
      if (idx > -1) {
        arr.splice(idx, 1);
        arr.unshift(kp);
      }
    }
    return arr;
  });

  constructor() {
    const chromeApi = (window as any).chrome;
    this.isDevTools.set(!!(chromeApi?.devtools?.inspectedWindow));
    this.init();
  }

  async init(): Promise<void> {
    if (!this.isDevTools()) {
      await this.ensureSampleData();
    }
    await this.loadDatabases();
  }

  // -------------------------------------------------------------
  // Bridge evaluation (DevTools inspected window eval)
  // -------------------------------------------------------------

  private async evalInDevTools<T>(code: string): Promise<T> {
    const chromeApi = (window as any).chrome;
    return new Promise<T>((resolve, reject) => {
      const runnerScript = `
        (function() {
          window.__idb_tasks = window.__idb_tasks || {};
          var taskId = 't_' + Math.random().toString(36).slice(2);
          window.__idb_tasks[taskId] = { done: false, error: null, data: null };
          (async function() {
            try {
              var res = await (${code});
              window.__idb_tasks[taskId] = { done: true, data: res };
            } catch (err) {
              window.__idb_tasks[taskId] = { done: true, error: err && err.message ? err.message : String(err) };
            }
          })();
          return taskId;
        })()
      `;

      chromeApi.devtools.inspectedWindow.eval(runnerScript, (taskId: string, isException: any) => {
        if (isException || !taskId) {
          reject(new Error(isException?.value || 'Failed to initialize task in target window'));
          return;
        }

        const startTime = Date.now();
        const pollInterval = setInterval(() => {
          const checkScript = `
            (function() {
              var task = window.__idb_tasks ? window.__idb_tasks['${taskId}'] : null;
              if (!task || !task.done) return null;
              var res = { error: task.error, data: task.data };
              delete window.__idb_tasks['${taskId}'];
              return res;
            })()
          `;
          chromeApi.devtools.inspectedWindow.eval(checkScript, (result: any, pollException: any) => {
            if (pollException) {
              clearInterval(pollInterval);
              reject(new Error(pollException.value || 'Error checking task status'));
              return;
            }
            if (result) {
              clearInterval(pollInterval);
              if (result.error) {
                reject(new Error(result.error));
              } else {
                resolve(result.data);
              }
            } else if (Date.now() - startTime > 15000) {
              clearInterval(pollInterval);
              reject(new Error('IndexedDB operation timed out'));
            }
          });
        }, 30);
      });
    });
  }

  // -------------------------------------------------------------
  // Database Operations
  // -------------------------------------------------------------

  async loadDatabases(): Promise<void> {
    this.loadingDatabases.set(true);
    this.error.set(null);
    try {
      let dbs: IDBDatabaseMeta[] = [];

      if (this.isDevTools()) {
        const code = `
          (async function() {
            if (typeof indexedDB.databases === 'function') {
              var list = await indexedDB.databases();
              return (list || []).map(function(d) {
                return { name: d.name, version: d.version || 1 };
              });
            }
            return [];
          })()
        `;
        dbs = await this.evalInDevTools<IDBDatabaseMeta[]>(code);
      } else {
        if (typeof indexedDB.databases === 'function') {
          const list = await indexedDB.databases();
          dbs = (list || []).map(d => ({ name: d.name || '', version: d.version || 1 }));
        }
      }

      this.databases.set(dbs || []);

      const current = this.activeDatabaseName();
      if (!current && dbs.length > 0) {
        await this.selectDatabase(dbs[0].name);
      } else if (current && !dbs.some(d => d.name === current) && dbs.length > 0) {
        await this.selectDatabase(dbs[0].name);
      }
    } catch (err: any) {
      console.error('Error loading databases:', err);
      this.error.set(`Failed to load databases: ${err.message || err}`);
    } finally {
      this.loadingDatabases.set(false);
    }
  }

  async selectDatabase(dbName: string): Promise<void> {
    if (this.activeDatabaseName() === dbName && this.stores().length > 0) {
      return;
    }
    this.activeDatabaseName.set(dbName);
    this.activeStoreName.set(null);
    this.records.set([]);
    this.selectedRecord.set(null);
    this.loadingStores.set(true);
    this.error.set(null);

    try {
      let stores: IDBStoreMeta[] = [];

      if (this.isDevTools()) {
        const code = `
          (function() {
            return new Promise(function(resolve, reject) {
              var req = indexedDB.open('${dbName}');
              req.onerror = function() { reject(req.error); };
              req.onsuccess = function() {
                var db = req.result;
                var storeNames = Array.from(db.objectStoreNames);
                if (storeNames.length === 0) {
                  db.close();
                  resolve([]);
                  return;
                }
                var tx = db.transaction(storeNames, 'readonly');
                var results = [];
                var pendingCounts = storeNames.length;

                storeNames.forEach(function(name) {
                  var store = tx.objectStore(name);
                  var indexes = Array.from(store.indexNames).map(function(idxName) {
                    var idx = store.index(idxName);
                    return {
                      name: idx.name,
                      keyPath: idx.keyPath,
                      unique: idx.unique,
                      multiEntry: idx.multiEntry
                    };
                  });
                  var meta = {
                    name: store.name,
                    keyPath: store.keyPath,
                    autoIncrement: store.autoIncrement,
                    indexes: indexes,
                    recordCount: 0
                  };
                  var countReq = store.count();
                  countReq.onsuccess = function() {
                    meta.recordCount = countReq.result;
                    results.push(meta);
                    pendingCounts--;
                    if (pendingCounts === 0) {
                      db.close();
                      resolve(results);
                    }
                  };
                  countReq.onerror = function() {
                    results.push(meta);
                    pendingCounts--;
                    if (pendingCounts === 0) {
                      db.close();
                      resolve(results);
                    }
                  };
                });
              };
            });
          })()
        `;
        stores = await this.evalInDevTools<IDBStoreMeta[]>(code);
      } else {
        stores = await new Promise<IDBStoreMeta[]>((resolve, reject) => {
          const req = indexedDB.open(dbName);
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result;
            const storeNames = Array.from(db.objectStoreNames);
            if (storeNames.length === 0) {
              db.close();
              resolve([]);
              return;
            }
            const tx = db.transaction(storeNames, 'readonly');
            const results: IDBStoreMeta[] = [];
            let pendingCounts = storeNames.length;

            storeNames.forEach(name => {
              const store = tx.objectStore(name);
              const indexes = Array.from(store.indexNames).map(idxName => {
                const idx = store.index(idxName);
                return {
                  name: idx.name,
                  keyPath: idx.keyPath as any,
                  unique: idx.unique,
                  multiEntry: idx.multiEntry
                };
              });
              const meta: IDBStoreMeta = {
                name: store.name,
                keyPath: store.keyPath as any,
                autoIncrement: store.autoIncrement,
                indexes,
                recordCount: 0
              };
              const countReq = store.count();
              countReq.onsuccess = () => {
                meta.recordCount = countReq.result;
                results.push(meta);
                pendingCounts--;
                if (pendingCounts === 0) {
                  db.close();
                  resolve(results);
                }
              };
              countReq.onerror = () => {
                results.push(meta);
                pendingCounts--;
                if (pendingCounts === 0) {
                  db.close();
                  resolve(results);
                }
              };
            });
          };
        });
      }

      this.stores.set(stores);

      if (stores.length > 0) {
        await this.selectStore(stores[0].name);
      }
    } catch (err: any) {
      console.error(`Error opening database ${dbName}:`, err);
      this.error.set(`Failed to open database "${dbName}": ${err.message || err}`);
    } finally {
      this.loadingStores.set(false);
    }
  }

  // -------------------------------------------------------------
  // Store / Table Operations
  // -------------------------------------------------------------

  async selectStore(storeName: string, page = 1, pageSize?: number): Promise<void> {
    this.activeStoreName.set(storeName);
    this.selectedRecord.set(null);
    const size = pageSize || this.pagination().pageSize;

    await this.fetchStoreRecords({
      page,
      pageSize: size,
      filterText: this.filterQuery()
    });
  }

  async setPage(page: number): Promise<void> {
    const current = this.pagination();
    if (page < 1 || (current.totalPages > 0 && page > current.totalPages)) return;
    await this.fetchStoreRecords({
      page,
      pageSize: current.pageSize,
      filterText: this.filterQuery()
    });
  }

  async setPageSize(size: number): Promise<void> {
    await this.fetchStoreRecords({
      page: 1,
      pageSize: size,
      filterText: this.filterQuery()
    });
  }

  async setFilter(text: string): Promise<void> {
    this.filterQuery.set(text);
    await this.fetchStoreRecords({
      page: 1,
      pageSize: this.pagination().pageSize,
      filterText: text
    });
  }

  async refreshCurrentStore(): Promise<void> {
    const store = this.activeStoreName();
    if (!store) return;
    await this.fetchStoreRecords({
      page: this.pagination().page,
      pageSize: this.pagination().pageSize,
      filterText: this.filterQuery()
    });
    await this.refreshStoreCounts();
  }

  private async refreshStoreCounts(): Promise<void> {
    const dbName = this.activeDatabaseName();
    const storeName = this.activeStoreName();
    if (!dbName || !storeName) return;

    try {
      let count = 0;
      if (this.isDevTools()) {
        const code = `
          (function() {
            return new Promise(function(resolve, reject) {
              var req = indexedDB.open('${dbName}');
              req.onsuccess = function() {
                var db = req.result;
                var tx = db.transaction('${storeName}', 'readonly');
                var store = tx.objectStore('${storeName}');
                var countReq = store.count();
                countReq.onsuccess = function() {
                  var c = countReq.result;
                  db.close();
                  resolve(c);
                };
                countReq.onerror = function() { db.close(); resolve(0); };
              };
              req.onerror = function() { reject(req.error); };
            });
          })()
        `;
        count = await this.evalInDevTools<number>(code);
      } else {
        count = await new Promise<number>((resolve) => {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const countReq = store.count();
            countReq.onsuccess = () => {
              db.close();
              resolve(countReq.result);
            };
            countReq.onerror = () => {
              db.close();
              resolve(0);
            };
          };
          req.onerror = () => resolve(0);
        });
      }

      this.stores.update(stores =>
        stores.map(s => s.name === storeName ? { ...s, recordCount: count } : s)
      );
    } catch {
      // Ignore count refresh errors
    }
  }

  async fetchStoreRecords(options: QueryOptions): Promise<void> {
    const dbName = this.activeDatabaseName();
    const storeName = this.activeStoreName();
    if (!dbName || !storeName) return;

    this.loadingRecords.set(true);
    this.error.set(null);

    try {
      const filter = (options.filterText || '').trim().toLowerCase();
      const page = options.page || 1;
      const pageSize = options.pageSize || 25;
      const offset = (page - 1) * pageSize;

      let result: { total: number; records: { key: any; primaryKey: any; value: any }[] };

      if (this.isDevTools()) {
        const code = `
          (function() {
            return new Promise(function(resolve, reject) {
              var req = indexedDB.open('${dbName}');
              req.onerror = function() { reject(req.error); };
              req.onsuccess = function() {
                var db = req.result;
                var tx = db.transaction('${storeName}', 'readonly');
                var store = tx.objectStore('${storeName}');

                var filterText = ${JSON.stringify(filter)};
                var targetOffset = ${offset};
                var limit = ${pageSize};

                var records = [];
                var matchingCount = 0;
                var cursorReq = store.openCursor();

                cursorReq.onsuccess = function(e) {
                  var cursor = e.target.result;
                  if (cursor) {
                    var val = cursor.value;
                    var matches = true;

                    if (filterText) {
                      try {
                        var str = typeof val === 'object' ? JSON.stringify(val).toLowerCase() : String(val).toLowerCase();
                        var keyStr = String(cursor.key).toLowerCase();
                        matches = str.indexOf(filterText) > -1 || keyStr.indexOf(filterText) > -1;
                      } catch(err) {
                        matches = false;
                      }
                    }

                    if (matches) {
                      if (matchingCount >= targetOffset && records.length < limit) {
                        records.push({
                          key: cursor.key,
                          primaryKey: cursor.primaryKey,
                          value: val
                        });
                      }
                      matchingCount++;
                    }
                    cursor.continue();
                  } else {
                    db.close();
                    resolve({
                      total: matchingCount,
                      records: records
                    });
                  }
                };

                cursorReq.onerror = function() {
                  db.close();
                  reject(cursorReq.error);
                };
              };
            });
          })()
        `;
        result = await this.evalInDevTools<{ total: number; records: { key: any; primaryKey: any; value: any }[] }>(code);
      } else {
        result = await new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName);
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const records: { key: any; primaryKey: any; value: any }[] = [];
            let matchingCount = 0;
            const cursorReq = store.openCursor();

            cursorReq.onsuccess = (e: any) => {
              const cursor = e.target.result;
              if (cursor) {
                const val = cursor.value;
                let matches = true;

                if (filter) {
                  try {
                    const str = typeof val === 'object' ? JSON.stringify(val).toLowerCase() : String(val).toLowerCase();
                    const keyStr = String(cursor.key).toLowerCase();
                    matches = str.includes(filter) || keyStr.includes(filter);
                  } catch {
                    matches = false;
                  }
                }

                if (matches) {
                  if (matchingCount >= offset && records.length < pageSize) {
                    records.push({
                      key: cursor.key,
                      primaryKey: cursor.primaryKey,
                      value: val
                    });
                  }
                  matchingCount++;
                }
                cursor.continue();
              } else {
                db.close();
                resolve({ total: matchingCount, records });
              }
            };

            cursorReq.onerror = () => {
              db.close();
              reject(cursorReq.error);
            };
          };
        });
      }

      const items: IDBRecordItem[] = (result.records || []).map((r, idx) => ({
        key: r.key,
        primaryKey: r.primaryKey,
        value: r.value,
        _rowNum: offset + idx + 1,
        _isModified: false,
        _originalValue: JSON.parse(JSON.stringify(r.value))
      }));

      this.records.set(items);

      const total = result.total || 0;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      this.pagination.set({
        page,
        pageSize,
        total,
        totalPages
      });

      const currentSelected = this.selectedRecord();
      if (currentSelected) {
        const found = items.find(i => JSON.stringify(i.key) === JSON.stringify(currentSelected.key));
        this.selectedRecord.set(found || items[0] || null);
      } else if (items.length > 0) {
        this.selectedRecord.set(items[0]);
      } else {
        this.selectedRecord.set(null);
      }
    } catch (err: any) {
      console.error(`Error fetching records for ${storeName}:`, err);
      this.error.set(`Failed to fetch records: ${err.message || err}`);
    } finally {
      this.loadingRecords.set(false);
    }
  }

  // -------------------------------------------------------------
  // Data Mutation: Inline Edit, Add, Delete, Clear
  // -------------------------------------------------------------

  async updateRecord(key: any, updatedValue: any): Promise<boolean> {
    const dbName = this.activeDatabaseName();
    const store = this.activeStore();
    if (!dbName || !store) return false;

    try {
      const isOutOfLine = store.keyPath === null;

      if (this.isDevTools()) {
        const serializedKey = JSON.stringify(key);
        const serializedValue = JSON.stringify(updatedValue);
        const code = `
          (function() {
            return new Promise(function(resolve, reject) {
              var req = indexedDB.open('${dbName}');
              req.onsuccess = function() {
                var db = req.result;
                var tx = db.transaction('${store.name}', 'readwrite');
                var objStore = tx.objectStore('${store.name}');
                var putReq;
                var val = ${serializedValue};
                var key = ${serializedKey};

                if (${isOutOfLine}) {
                  putReq = objStore.put(val, key);
                } else {
                  putReq = objStore.put(val);
                }

                tx.oncomplete = function() {
                  db.close();
                  resolve(true);
                };
                tx.onerror = function() {
                  db.close();
                  reject(tx.error || putReq.error);
                };
              };
              req.onerror = function() { reject(req.error); };
            });
          })()
        `;
        await this.evalInDevTools<boolean>(code);
      } else {
        await new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(store.name, 'readwrite');
            const objStore = tx.objectStore(store.name);
            const putReq = isOutOfLine ? objStore.put(updatedValue, key) : objStore.put(updatedValue);
            tx.oncomplete = () => { db.close(); resolve(true); };
            tx.onerror = () => { db.close(); reject(tx.error || putReq.error); };
          };
          req.onerror = () => reject(req.error);
        });
      }

      this.records.update(list =>
        list.map(item => {
          if (JSON.stringify(item.key) === JSON.stringify(key)) {
            return {
              ...item,
              value: updatedValue,
              _isModified: false,
              _originalValue: JSON.parse(JSON.stringify(updatedValue))
            };
          }
          return item;
        })
      );

      if (this.selectedRecord() && JSON.stringify(this.selectedRecord()?.key) === JSON.stringify(key)) {
        const item = this.records().find(i => JSON.stringify(i.key) === JSON.stringify(key));
        if (item) this.selectedRecord.set(item);
      }

      return true;
    } catch (err: any) {
      console.error('Error updating record:', err);
      this.error.set(`Update failed: ${err.message || err}`);
      return false;
    }
  }

  async deleteRecord(key: any): Promise<boolean> {
    const dbName = this.activeDatabaseName();
    const store = this.activeStore();
    if (!dbName || !store) return false;

    try {
      if (this.isDevTools()) {
        const serializedKey = JSON.stringify(key);
        const code = `
          (function() {
            return new Promise(function(resolve, reject) {
              var req = indexedDB.open('${dbName}');
              req.onsuccess = function() {
                var db = req.result;
                var tx = db.transaction('${store.name}', 'readwrite');
                var objStore = tx.objectStore('${store.name}');
                objStore.delete(${serializedKey});
                tx.oncomplete = function() {
                  db.close();
                  resolve(true);
                };
                tx.onerror = function() {
                  db.close();
                  reject(tx.error);
                };
              };
              req.onerror = function() { reject(req.error); };
            });
          })()
        `;
        await this.evalInDevTools<boolean>(code);
      } else {
        await new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(store.name, 'readwrite');
            const objStore = tx.objectStore(store.name);
            objStore.delete(key);
            tx.oncomplete = () => { db.close(); resolve(true); };
            tx.onerror = () => { db.close(); reject(tx.error); };
          };
          req.onerror = () => reject(req.error);
        });
      }

      await this.refreshCurrentStore();
      return true;
    } catch (err: any) {
      console.error('Error deleting record:', err);
      this.error.set(`Delete failed: ${err.message || err}`);
      return false;
    }
  }

  async addRecord(value: any, key?: any): Promise<boolean> {
    const dbName = this.activeDatabaseName();
    const store = this.activeStore();
    if (!dbName || !store) return false;

    try {
      const isOutOfLine = store.keyPath === null;

      if (this.isDevTools()) {
        const serializedKey = key !== undefined ? JSON.stringify(key) : 'undefined';
        const serializedValue = JSON.stringify(value);
        const code = `
          (function() {
            return new Promise(function(resolve, reject) {
              var req = indexedDB.open('${dbName}');
              req.onsuccess = function() {
                var db = req.result;
                var tx = db.transaction('${store.name}', 'readwrite');
                var objStore = tx.objectStore('${store.name}');
                var addReq;
                var val = ${serializedValue};
                var key = ${serializedKey};

                if (${isOutOfLine} && key !== undefined) {
                  addReq = objStore.add(val, key);
                } else {
                  addReq = objStore.add(val);
                }

                tx.oncomplete = function() {
                  db.close();
                  resolve(true);
                };
                tx.onerror = function() {
                  db.close();
                  reject(tx.error || (addReq && addReq.error));
                };
              };
              req.onerror = function() { reject(req.error); };
            });
          })()
        `;
        await this.evalInDevTools<boolean>(code);
      } else {
        await new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(store.name, 'readwrite');
            const objStore = tx.objectStore(store.name);
            const addReq = (isOutOfLine && key !== undefined) ? objStore.add(value, key) : objStore.add(value);
            tx.oncomplete = () => { db.close(); resolve(true); };
            tx.onerror = () => { db.close(); reject(tx.error || (addReq && addReq.error)); };
          };
          req.onerror = () => reject(req.error);
        });
      }

      await this.refreshCurrentStore();
      return true;
    } catch (err: any) {
      console.error('Error adding record:', err);
      this.error.set(`Add record failed: ${err.message || err}`);
      return false;
    }
  }

  async clearStore(): Promise<boolean> {
    const dbName = this.activeDatabaseName();
    const store = this.activeStore();
    if (!dbName || !store) return false;

    try {
      if (this.isDevTools()) {
        const code = `
          (function() {
            return new Promise(function(resolve, reject) {
              var req = indexedDB.open('${dbName}');
              req.onsuccess = function() {
                var db = req.result;
                var tx = db.transaction('${store.name}', 'readwrite');
                var objStore = tx.objectStore('${store.name}');
                objStore.clear();
                tx.oncomplete = function() {
                  db.close();
                  resolve(true);
                };
                tx.onerror = function() {
                  db.close();
                  reject(tx.error);
                };
              };
              req.onerror = function() { reject(req.error); };
            });
          })()
        `;
        await this.evalInDevTools<boolean>(code);
      } else {
        await new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => {
            const db = req.result;
            const tx = db.transaction(store.name, 'readwrite');
            const objStore = tx.objectStore(store.name);
            objStore.clear();
            tx.oncomplete = () => { db.close(); resolve(true); };
            tx.onerror = () => { db.close(); reject(tx.error); };
          };
          req.onerror = () => reject(req.error);
        });
      }

      await this.refreshCurrentStore();
      return true;
    } catch (err: any) {
      console.error('Error clearing store:', err);
      this.error.set(`Clear failed: ${err.message || err}`);
      return false;
    }
  }

  selectRecord(record: IDBRecordItem | null): void {
    this.selectedRecord.set(record);
  }

  // -------------------------------------------------------------
  // Realistic Seed Data for Development / Testing
  // -------------------------------------------------------------

  async ensureSampleData(): Promise<void> {
    if (typeof indexedDB === 'undefined') return;

    try {
      const existing = typeof indexedDB.databases === 'function' ? await indexedDB.databases() : [];
      if (existing && existing.length > 0) return;

      console.log('Seeding demo IndexedDB databases for development...');
      await this.seedEcommerceDb();
      await this.seedCrmDb();
    } catch (e) {
      console.warn('Could not check or seed databases:', e);
    }
  }

  private seedEcommerceDb(): Promise<void> {
    return new Promise((resolve) => {
      const req = indexedDB.open('ecommerce_store', 1);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;

        const products = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
        products.createIndex('category', 'category', { unique: false });
        products.createIndex('price', 'price', { unique: false });
        products.createIndex('inStock', 'inStock', { unique: false });

        const customers = db.createObjectStore('customers', { keyPath: 'id', autoIncrement: true });
        customers.createIndex('email', 'email', { unique: true });
        customers.createIndex('country', 'country', { unique: false });

        const orders = db.createObjectStore('orders', { keyPath: 'orderNumber' });
        orders.createIndex('status', 'status', { unique: false });
        orders.createIndex('total', 'total', { unique: false });

        db.createObjectStore('app_settings');
      };

      req.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction(['products', 'customers', 'orders', 'app_settings'], 'readwrite');

        const prodStore = tx.objectStore('products');
        const categories = ['Electronics', 'Home & Kitchen', 'Apparel', 'Books', 'Sports'];
        for (let i = 1; i <= 65; i++) {
          prodStore.add({
            title: `Item Pro ${i} - Standard Edition`,
            category: categories[i % categories.length],
            price: Number((19.99 + (i * 3.45) % 150).toFixed(2)),
            rating: Number((3.5 + ((i % 15) / 10)).toFixed(1)),
            inStock: i % 7 !== 0,
            inventory: (i * 13) % 100,
            tags: ['popular', i % 2 === 0 ? 'discount' : 'new-arrival'],
            metadata: {
              sku: `SKU-${1000 + i}`,
              weightKg: Number((0.5 + (i % 5) * 0.4).toFixed(2))
            }
          });
        }

        const custStore = tx.objectStore('customers');
        const countries = ['USA', 'Canada', 'Germany', 'Japan', 'UK', 'Australia'];
        const tiers = ['Gold', 'Silver', 'Platinum', 'Bronze'];
        for (let i = 1; i <= 35; i++) {
          custStore.add({
            name: `User ${i} Example`,
            email: `customer${i}@company.io`,
            country: countries[i % countries.length],
            tier: tiers[i % tiers.length],
            ordersCount: (i * 3) % 20,
            isVerified: i % 3 !== 0,
            lastActive: new Date(Date.now() - i * 86400000).toISOString().split('T')[0]
          });
        }

        const orderStore = tx.objectStore('orders');
        const statuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        for (let i = 1; i <= 40; i++) {
          orderStore.add({
            orderNumber: `ORD-${202600 + i}`,
            customerId: (i % 35) + 1,
            status: statuses[i % statuses.length],
            total: Number((45.5 + (i * 12.3) % 350).toFixed(2)),
            itemCount: (i % 5) + 1,
            paid: i % 5 !== 0,
            createdAt: new Date(Date.now() - i * 3600000 * 5).toISOString()
          });
        }

        const settingsStore = tx.objectStore('app_settings');
        settingsStore.add({ theme: 'system', autoSync: true, syncIntervalSec: 60 }, 'client_config');
        settingsStore.add({ apiEndpoint: 'https://api.example.com/v1', retryLimit: 3 }, 'network_config');
        settingsStore.add(['admin', 'editor', 'viewer'], 'user_roles');
        settingsStore.add('v2.4.1-build-98', 'app_version');

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      };
      req.onerror = () => resolve();
    });
  }

  private seedCrmDb(): Promise<void> {
    return new Promise((resolve) => {
      const req = indexedDB.open('crm_analytics', 1);
      req.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        const leads = db.createObjectStore('leads', { keyPath: 'uuid' });
        leads.createIndex('stage', 'stage', { unique: false });
        leads.createIndex('value', 'value', { unique: false });

        db.createObjectStore('logs', { keyPath: 'id', autoIncrement: true });
      };

      req.onsuccess = (e: any) => {
        const db = e.target.result;
        const tx = db.transaction(['leads', 'logs'], 'readwrite');

        const leadStore = tx.objectStore('leads');
        const stages = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'];
        for (let i = 1; i <= 20; i++) {
          leadStore.add({
            uuid: `lead-${Math.random().toString(36).slice(2, 9)}`,
            company: `Enterprise Corp ${i}`,
            contactPerson: `Manager ${i}`,
            stage: stages[i % stages.length],
            value: 5000 + (i * 2500),
            probability: (i * 15) % 100
          });
        }

        const logStore = tx.objectStore('logs');
        for (let i = 1; i <= 50; i++) {
          logStore.add({
            event: ['login', 'update_profile', 'export_data', 'view_report'][i % 4],
            ip: `192.168.1.${10 + (i % 200)}`,
            success: i % 10 !== 0,
            timestamp: Date.now() - (i * 120000)
          });
        }

        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          resolve();
        };
      };
      req.onerror = () => resolve();
    });
  }
}
