const DB_NAME = 'ecosurvey-field-app';
const DB_VERSION = 5;
let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('surveys')) db.createObjectStore('surveys', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('records')) {
        const records = db.createObjectStore('records', { keyPath: 'key' });
        records.createIndex('bySurveyTable', ['surveyId', 'table']);
        records.createIndex('bySurvey', 'surveyId');
      }
      if (!db.objectStoreNames.contains('attachments')) {
        const attachments = db.createObjectStore('attachments', { keyPath: 'id' });
        attachments.createIndex('bySurvey', 'surveyId');
      }
      if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      if (!db.objectStoreNames.contains('basemapPacks')) {
        const basemapPacks = db.createObjectStore('basemapPacks', { keyPath: 'id' });
        basemapPacks.createIndex('bySurvey', 'surveyId');
      }
      if (!db.objectStoreNames.contains('qaqcRuns')) {
        const qaqcRuns = db.createObjectStore('qaqcRuns', { keyPath: 'id' });
        qaqcRuns.createIndex('bySurvey', 'surveyId');
        qaqcRuns.createIndex('bySurveyCreated', ['surveyId', 'created_at']);
      }
      if (!db.objectStoreNames.contains('speciesLists')) {
        const speciesLists = db.createObjectStore('speciesLists', { keyPath: 'id' });
        speciesLists.createIndex('byProject', 'project_id');
      }
      if (!db.objectStoreNames.contains('taxa')) {
        const taxa = db.createObjectStore('taxa', { keyPath: 'id' });
        taxa.createIndex('byList', 'list_id');
        taxa.createIndex('byProject', 'project_id');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function requestPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSurveys() {
  const db = await openDb();
  return requestPromise(db.transaction('surveys').objectStore('surveys').getAll());
}
export async function getSurvey(id) {
  const db = await openDb();
  return requestPromise(db.transaction('surveys').objectStore('surveys').get(id));
}
export async function saveSurvey(survey) {
  const db = await openDb();
  const tx = db.transaction('surveys', 'readwrite');
  tx.objectStore('surveys').put(survey);
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
export async function deleteSurvey(id) {
  const db = await openDb();
  const tx = db.transaction(['surveys', 'records', 'attachments', 'qaqcRuns', 'basemapPacks'], 'readwrite');
  tx.objectStore('surveys').delete(id);
  const recordIndex = tx.objectStore('records').index('bySurvey');
  const recordReq = recordIndex.openCursor(IDBKeyRange.only(id));
  recordReq.onsuccess = () => { const cursor = recordReq.result; if (cursor) { cursor.delete(); cursor.continue(); } };
  const attachmentIndex = tx.objectStore('attachments').index('bySurvey');
  const attachmentReq = attachmentIndex.openCursor(IDBKeyRange.only(id));
  attachmentReq.onsuccess = () => { const cursor = attachmentReq.result; if (cursor) { cursor.delete(); cursor.continue(); } };
  const qaqcIndex = tx.objectStore('qaqcRuns').index('bySurvey');
  const qaqcReq = qaqcIndex.openCursor(IDBKeyRange.only(id));
  qaqcReq.onsuccess = () => { const cursor = qaqcReq.result; if (cursor) { cursor.delete(); cursor.continue(); } };
  const basemapIndex = tx.objectStore('basemapPacks').index('bySurvey');
  const basemapReq = basemapIndex.openCursor(IDBKeyRange.only(id));
  basemapReq.onsuccess = () => { const cursor = basemapReq.result; if (cursor) { cursor.delete(); cursor.continue(); } };
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
export async function getRecords(surveyId, table) {
  const db = await openDb();
  const index = db.transaction('records').objectStore('records').index('bySurveyTable');
  const rows = await requestPromise(index.getAll(IDBKeyRange.only([surveyId, table])));
  return rows.map((row) => row.data).sort((a, b) => String(a._createdAt || '').localeCompare(String(b._createdAt || '')));
}
export async function getAllRecords(surveyId) {
  const db = await openDb();
  const rows = await requestPromise(db.transaction('records').objectStore('records').index('bySurvey').getAll(IDBKeyRange.only(surveyId)));
  return rows;
}
export async function saveRecord(surveyId, table, id, data) {
  const db = await openDb();
  const key = `${surveyId}|${table}|${id}`;
  const tx = db.transaction('records', 'readwrite');
  tx.objectStore('records').put({ key, surveyId, table, id, data });
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
export async function deleteRecord(surveyId, table, id) {
  const db = await openDb();
  return requestPromise(db.transaction('records', 'readwrite').objectStore('records').delete(`${surveyId}|${table}|${id}`));
}
export async function saveRecordsBatch(surveyId, entries = []) {
  const db = await openDb();
  const tx = db.transaction('records', 'readwrite');
  const store = tx.objectStore('records');
  entries.forEach(({ table, id, data }) => {
    if (!table || !id) throw new Error('Batch record is missing table or ID.');
    store.put({ key: `${surveyId}|${table}|${id}`, surveyId, table, id, data });
  });
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || new Error('Batch record save aborted.')); });
}
export async function saveAttachment(attachment) {
  const db = await openDb();
  const tx = db.transaction('attachments', 'readwrite');
  tx.objectStore('attachments').put(attachment);
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
export async function getAttachment(id) {
  const db = await openDb();
  return requestPromise(db.transaction('attachments').objectStore('attachments').get(id));
}
export async function getAttachments(surveyId) {
  const db = await openDb();
  return requestPromise(db.transaction('attachments').objectStore('attachments').index('bySurvey').getAll(IDBKeyRange.only(surveyId)));
}
export async function deleteAttachment(id) {
  const db = await openDb();
  return requestPromise(db.transaction('attachments', 'readwrite').objectStore('attachments').delete(id));
}
export async function getSetting(key) {
  const db = await openDb();
  const result = await requestPromise(db.transaction('settings').objectStore('settings').get(key));
  return result?.value;
}
export async function setSetting(key, value) {
  const db = await openDb();
  return requestPromise(db.transaction('settings', 'readwrite').objectStore('settings').put({ key, value }));
}

export async function saveQaqcRun(surveyId, run) {
  const db = await openDb();
  const tx = db.transaction('qaqcRuns', 'readwrite');
  tx.objectStore('qaqcRuns').put({ ...run, surveyId });
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
export async function getQaqcRuns(surveyId) {
  const db = await openDb();
  const runs = await requestPromise(db.transaction('qaqcRuns').objectStore('qaqcRuns').index('bySurvey').getAll(IDBKeyRange.only(surveyId)));
  return runs.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}
export async function getLatestQaqcRun(surveyId) {
  const runs = await getQaqcRuns(surveyId);
  return runs[0] || null;
}

export async function getBasemapPacks(surveyId) {
  const db = await openDb();
  const rows = await requestPromise(db.transaction('basemapPacks').objectStore('basemapPacks').index('bySurvey').getAll(IDBKeyRange.only(surveyId)));
  return rows.sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
}
export async function saveBasemapPack(pack) {
  const db = await openDb();
  const tx = db.transaction('basemapPacks', 'readwrite');
  tx.objectStore('basemapPacks').put(pack);
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
export async function deleteBasemapPack(id) {
  const db = await openDb();
  return requestPromise(db.transaction('basemapPacks', 'readwrite').objectStore('basemapPacks').delete(id));
}


export async function getSpeciesLists(projectId) {
  const db = await openDb();
  const rows = await requestPromise(db.transaction('speciesLists').objectStore('speciesLists').index('byProject').getAll(IDBKeyRange.only(projectId)));
  return rows.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}
export async function getTaxa(listId) {
  const db = await openDb();
  const rows = await requestPromise(db.transaction('taxa').objectStore('taxa').index('byList').getAll(IDBKeyRange.only(listId)));
  return rows.sort((a, b) => String(a.scientific_name || a.common_name || a.taxon_key || '').localeCompare(String(b.scientific_name || b.common_name || b.taxon_key || '')));
}
export async function saveSpeciesList(list) {
  const db = await openDb();
  const tx = db.transaction('speciesLists', 'readwrite');
  tx.objectStore('speciesLists').put(list);
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
export async function replaceTaxaForList(list, taxaRows) {
  const db = await openDb();
  const tx = db.transaction(['speciesLists', 'taxa'], 'readwrite');
  tx.objectStore('speciesLists').put({ ...list, taxon_count: taxaRows.length, updated_at: new Date().toISOString() });
  const index = tx.objectStore('taxa').index('byList');
  const request = index.openCursor(IDBKeyRange.only(list.id));
  request.onsuccess = () => { const cursor = request.result; if (cursor) { cursor.delete(); cursor.continue(); } };
  const packFields = list.list_kind === 'regional_pack' ? {
    taxon_pack_id: list.taxon_pack_id || '',
    taxon_pack_name: list.taxon_pack_name || list.name || '',
    taxon_pack_version: list.taxon_pack_version || '',
    taxon_pack_region: list.taxon_pack_region || '',
    taxon_pack_review_status: list.taxon_pack_review_status || ''
  } : {};
  taxaRows.forEach((row) => tx.objectStore('taxa').put({ ...row, ...packFields, id: `${list.id}|${row.taxon_key}`, list_id: list.id, list_name: list.name, project_id: list.project_id }));
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
export async function saveTaxon(taxon) {
  const db = await openDb();
  const tx = db.transaction('taxa', 'readwrite');
  tx.objectStore('taxa').put(taxon);
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
export async function deleteSpeciesList(id) {
  const db = await openDb();
  const tx = db.transaction(['speciesLists', 'taxa'], 'readwrite');
  tx.objectStore('speciesLists').delete(id);
  const index = tx.objectStore('taxa').index('byList');
  const request = index.openCursor(IDBKeyRange.only(id));
  request.onsuccess = () => { const cursor = request.result; if (cursor) { cursor.delete(); cursor.continue(); } };
  return new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
