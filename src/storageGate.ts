// Every current client uses the same IndexedDB read/write transaction gate, including
// clients that also have Web Locks. A localStorage lease is not an atomic lock.
const DATABASE = 'airtruckers-save-coordination';
const STORE = 'save-gate';
export function coordinateSave<T>(write: () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) {
      reject(new Error('Safe saving is unavailable: browser database access is disabled. Enable site storage, then retry. Existing saves can still be read and exported.'));
      return;
    }
    const opening = indexedDB.open(DATABASE, 1);
    let blocked = false;
    opening.onupgradeneeded = () => { opening.result.createObjectStore(STORE); };
    opening.onerror = () => reject(new Error('Browser database access failed. Enable site storage and retry; no save was changed.'));
    opening.onblocked = () => { blocked = true; reject(new Error('Save coordination is blocked by another tab. Close other AirTruckers tabs and retry.')); };
    opening.onsuccess = () => {
      const database = opening.result;
      if (blocked) { database.close(); return; }
      database.onversionchange = () => database.close();
      try {
        const transaction = database.transaction(STORE, 'readwrite');
        transaction.oncomplete = () => database.close();
        transaction.onabort = () => { database.close(); reject(new Error('Save coordination was interrupted. Retry the action.')); };
        transaction.onerror = () => { /* onabort handles errors without suppressing the abort. */ };
        const request = transaction.objectStore(STORE).get('gate');
        request.onsuccess = () => {
          try {
            // Synchronous check + one localStorage write while the cross-tab transaction
            // owns the gate. Resolve at the authoritative write, not at a later IDB event:
            // an IDB abort after a successful localStorage write must not report a failed payment.
            resolve(write());
          } catch (error) { reject(error); }
        };
      } catch (error) { database.close(); reject(error); }
    };
  });
}
export async function withSaveCoordination<T>(name: string, write: () => T): Promise<T> {
  const locks = globalThis.navigator?.locks;
  if (typeof locks?.request !== 'function') return coordinateSave(write);
  let entered = false;
  try {
    return await locks.request(name, () => { entered = true; return coordinateSave(write); });
  } catch (error) {
    // Some browsers expose Web Locks but reject its use. Fall back only if the
    // protected callback never ran; never retry a failed or completed write.
    if (entered) throw error;
    return coordinateSave(write);
  }
}
