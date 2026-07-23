import { dbGet, dbSet, openDB } from "./heavy-storage/indexeddb-driver";

const FALLBACK_DB_NAME = 'typed-storage-quota-fallback';

export function backupToIndexedDB ( 
    key: string, 
    value: string 
): void {
    // fire-and-forget no bloqueamos el flujo sincrono principal
    openDB(FALLBACK_DB_NAME)
        .then( db => dbSet(db, key, value) )
        .catch( err => 
            console.warn('typed-storage: no se pudo respaldar en IndexedDB', err) 
        )
}

export async function restoreFromIndexedDB (
    key: string
): Promise<string | undefined> {
    try {
        const db = await openDB(FALLBACK_DB_NAME);

        return await dbGet(db, key);
    } catch (error) {
        return undefined;
    }
}