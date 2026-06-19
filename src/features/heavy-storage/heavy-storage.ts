// Indexed
import { 
    dbDelete, 
    dbGet, 
    dbSet, 
    openDB 
} from "./indexeddb-driver";

// Types
import { 
    HeavySignal, 
    HeavyStorageOptions, 
    HeavyStorageResult, 
    HeavyStorageSchema 
} from "./heavy-storage.types";

export function createHeavySignal<T>(
    key: string,
    initialValue: T,
    options?: HeavyStorageOptions
): HeavySignal<T> {
    const dbName = options?.dbName ?? 'typed-storage-heavy';
    const listeners: Array<(value: T) => void> = [];

    function notify ( value: T ): void {
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

    signal.onChange = function ( callback: (value: T) => void ): void {
        listeners.push(callback);
    };

    return signal as HeavySignal<T>;
}

// ===========================================
// Iteramos el schema completo

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