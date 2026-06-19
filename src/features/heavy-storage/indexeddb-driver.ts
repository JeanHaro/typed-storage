// Abrir/crear la base de datos
export function openDB(dbName: string): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            // Crea el "object store" — equivalente a una tabla
            if (!db.objectStoreNames.contains('storage')) {
                db.createObjectStore('storage');
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function dbGet(db: IDBDatabase, key: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('storage', 'readonly');
        const store = transaction.objectStore('storage');
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export function dbSet(db: IDBDatabase, key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('storage', 'readwrite');
        const store = transaction.objectStore('storage');
        const request = store.put(value, key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

export function dbDelete(db: IDBDatabase, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('storage', 'readwrite');
        const store = transaction.objectStore('storage');
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}