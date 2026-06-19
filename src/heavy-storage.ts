// Abrir/crear la base de datos
function openDB(dbName: string): Promise<IDBDatabase> {
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

function dbGet(db: IDBDatabase, key: string): Promise<any> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('storage', 'readonly');
        const store = transaction.objectStore('storage');
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function dbSet(db: IDBDatabase, key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('storage', 'readwrite');
        const store = transaction.objectStore('storage');
        const request = store.put(value, key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

function dbDelete(db: IDBDatabase, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction('storage', 'readwrite');
        const store = transaction.objectStore('storage');
        const request = store.delete(key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ===========================================

interface HeavyStorageOptions {
    dbName?: string;
    ttl?: number;
}

interface HeavySignal<T> {
    get(): Promise<T>;
    set(value: T): Promise<void>;
    remove(): Promise<void>;
    onChange(callback: (value: T) => void): void;
}

export function createHeavySignal<T>(
    key: string,
    initialValue: T,
    options?: HeavyStorageOptions
): HeavySignal<T> {
    const dbName = options?.dbName ?? 'typed-storage-heavy';
    const listeners: Array<(value: T) => void> = [];

    function notify(value: T): void {
        listeners.forEach(cb => cb(value));
    }

    const signal: any = {};

    signal.get = async function(): Promise<T> {
        const db = await openDB(dbName);
        const stored = await dbGet(db, key);
        
        if (stored === undefined) return initialValue;

        // Verifica TTL si existe
        if (stored.expiresAt && Date.now() > stored.expiresAt) {
            await dbDelete(db, key);
            return initialValue;
        }

        return stored.value ?? initialValue;
    };

    signal.set = async function(value: T): Promise<void> {
        const db = await openDB(dbName);
        await dbSet(db, key, {
            value,
            expiresAt: options?.ttl ? Date.now() + options.ttl : undefined
        });
        notify(value);
    };

    signal.remove = async function(): Promise<void> {
        const db = await openDB(dbName);
        await dbDelete(db, key);
        notify(initialValue);
    };

    signal.onChange = function(callback: (value: T) => void): void {
        listeners.push(callback);
    };

    return signal as HeavySignal<T>;
}

// ===========================================
// Iteramos el schema completo

type HeavyStorageSchema = Record<string, any>;

type HeavyStorageResult<T extends HeavyStorageSchema> = {
    [K in keyof T]: HeavySignal<T[K]>;
} & {
    clear(): Promise<void>;
};

export function createHeavyStorage<T extends HeavyStorageSchema>(
    schema: T,
    options?: HeavyStorageOptions
): HeavyStorageResult<T> {
    const result: any = {};

    const keys = Object.keys(schema);
    for (const key of keys) {
        result[key] = createHeavySignal(key, schema[key], options);
    }

    result.clear = async () => {
        for (const key of keys) {
            await result[key].remove();
        }
    };

    return result as HeavyStorageResult<T>;
}