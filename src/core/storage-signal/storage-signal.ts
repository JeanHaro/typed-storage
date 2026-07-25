import LZString from 'lz-string';

import { readInitialValue, safeParseJSON } from "./read-value.js";
import { setupSyncListener } from "./sync-listener.js";

// Xor
import { xorEncrypt, xorDecrypt } from "../../features/xor.js";

// MemoryStorage
import { MemoryStorage } from "../memory-storage.js";

// Types
import { 
    StorageSignal, 
    StorageSignalOptions 
} from "../../types.js";

// Validate
import { validateValue } from "../../features/validate-schema.js";

// Quota
import { getUsagePercent } from "../../features/quota-monitor.js";

// Quota Fallback
import { 
    backupToIndexedDB, 
    restoreFromIndexedDB 
} from "../../features/quota-fallback.js";

function isQuotaExceededError ( err: unknown ): boolean {
    return (
        err instanceof DOMException &&
        (err.name === 'QuotaExceededError' || err.code === 22)
    );
}

// Instancias compartidas de MemoryStorage — una por tipo (local/session)
let sharedMemoryStorageLocal: MemoryStorage | null = null;
let sharedMemoryStorageSession: MemoryStorage | null = null;

// Obtenemos el valor del localStorage o SessionStorage, sino MemoryStorage
export function getStorage ( type: 'local' | 'session' ): Storage | MemoryStorage {
    try {
        const sto = type === 'session' ? sessionStorage : localStorage;
        sto.setItem('__typed_storage_test__', '1');
        sto.removeItem('__typed_storage_test__');

        return sto;
    } catch {
        console.warn('Storage no disponible, usando memoria como fallback');

        // Reutiliza la MISMA instancia para todos los que pidan el mismo tipo,
        // así todos comparten los mismos datos en memoria
        if (type === 'session') {
            if (!sharedMemoryStorageSession) {
                sharedMemoryStorageSession = new MemoryStorage();
            }
            return sharedMemoryStorageSession;
        } else {
            if (!sharedMemoryStorageLocal) {
                sharedMemoryStorageLocal = new MemoryStorage();
            }
            return sharedMemoryStorageLocal;
        }
    }
}

// Creamos el Storage en modo signal
export function createStorageSignal<T>(
    key: string,
    initialValue: T,
    options?: StorageSignalOptions
): StorageSignal<T> {
    const originalKey = key;
    const validator = options?.validate?.[originalKey];

    let sto = getStorage(options?.storage ?? 'local');

    if (options?.prefix) {
        key = `${options.prefix}:${key}`;
    }

    // Lectura inicial — delegado al módulo extraído
    const { currentValue: initialCurrentValue, hadSavedData } = readInitialValue(key, initialValue, sto, options);
    let currentValue: T = initialCurrentValue;
    let currentUpdatedAt: number | undefined;

    const listeners: Array<(value: T) => void> = [];

    function notify (value: T): void {
        listeners.forEach(cb => cb(value));
    }

    // Intenta recuperar de IndexedDB si no había nada en localStorage
    if (!hadSavedData) {
        restoreFromIndexedDB(key).then((backupData) => {
            if (backupData) {
                let processedData = backupData;

                // Desencriptamos
                if ( options?.encrypt && options?.secret ) {
                    try {
                        processedData = xorDecrypt(processedData, options.secret);
                    } catch {
                        processedData = '';
                    }
                }

                // Descomprimimos
                if ( options?.compress && processedData ) {
                    processedData = LZString.decompressFromBase64(processedData);
                }

                const restoredItem = safeParseJSON(processedData, initialValue);
                currentValue = restoredItem.value;
                notify(currentValue);
            }
        });
    }

    const signalBase = function (): T {
        return currentValue;
    };

    // Sync entre tabs, ahora pasa getCurrentUpdatedAt
    setupSyncListener(
        key,
        initialValue,
        options,
        (value: T) => { currentValue = value; },
        notify,
        () => currentUpdatedAt
    );

    signalBase.set = function (newValue: T): void {
        const validation = validateValue(newValue, validator);

        if ( !validation.valid ) {
            throw new Error(`typed-storage: valor inválido para "${originalKey}": ${validation.error}`);
        }

        const oldValue = currentValue; // capturamos el valor anterior
        currentValue = newValue;
        currentUpdatedAt = Date.now();
        notify(currentValue);

        // Dispara onSet para cada plugin
        options?.plugins?.forEach( plugin => {
            plugin.onSet?.(originalKey, newValue, oldValue);
        });  

        const dataToStore = JSON.stringify({
            value: newValue,
            expiresAt: options?.ttl ? Date.now() + options.ttl : undefined,
            updatedAt: currentUpdatedAt
        });

        let finalData = options?.compress
            ? LZString.compressToBase64(dataToStore)
            : dataToStore;

        if (options?.encrypt && options?.secret) {
            finalData = xorEncrypt(finalData, options.secret);
        }

        try {
            sto.setItem(key, finalData);
        } catch (error) {
            if (isQuotaExceededError(error)) {
                console.warn(`typed-storage: cuota excedida al guardar "${key}", respaldando en IndexedDB`);
                backupToIndexedDB(key, finalData);
            } else {
                throw error;
            }
        }

        if (options?.onQuotaWarning && sto instanceof Storage) {
            const percent = getUsagePercent(sto);
            const threshold = options.quotaThreshold ?? 80;

            if (percent >= threshold) {
                options.onQuotaWarning(percent);
            }
        }
    };

    signalBase.reset = function (): void {
        currentValue = initialValue;
        currentUpdatedAt = Date.now();
        notify(currentValue);

        // Dispara onReset para cada plugin
        options?.plugins?.forEach( plugin => {
            plugin.onReset?.(originalKey);
        });

        const dataToStore = JSON.stringify({
            value: initialValue,
            expiresAt: options?.ttl ? Date.now() + options.ttl : undefined,
            updatedAt: currentUpdatedAt
        });

        let finalData = options?.compress
            ? LZString.compressToBase64(dataToStore)
            : dataToStore;

        if (options?.encrypt && options?.secret) {
            finalData = xorEncrypt(finalData, options.secret);
        }

        try {
            sto.setItem(key, finalData);
        } catch (error) {
            if (isQuotaExceededError(error)) {
                console.warn(`typed-storage: cuota excedida al guardar "${key}", respaldando en IndexedDB`);
                backupToIndexedDB(key, finalData);
            } else {
                throw error;
            }
        }

        if (options?.onQuotaWarning && sto instanceof Storage) {
            const percent = getUsagePercent(sto);
            const threshold = options.quotaThreshold ?? 80;

            if (percent >= threshold) {
                options.onQuotaWarning(percent);
            }
        }
    };

    signalBase.has = function (): boolean {
        return !!sto.getItem(key);
    };

    signalBase.remove = function (): void {
        sto.removeItem(key);
        currentValue = initialValue;
        notify(currentValue);

        // Dispara onRemove para cada plugin
        options?.plugins?.forEach( plugin => {
            plugin.onRemove?.(originalKey);
        });
    };

    signalBase.onChange = function (callback: (value: T) => void): () => void {
        listeners.push(callback);

        // Retorna una función que quita el callback específico
        return () => {
            const index = listeners.indexOf(callback);

            if ( index !== -1 ) {
                listeners.splice(index, 1);
            }
        };
    };

    return signalBase as StorageSignal<T>;
}