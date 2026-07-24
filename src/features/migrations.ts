import LZString from 'lz-string';
import { xorEncrypt, xorDecrypt } from './xor.js';
import { safeParseJSON } from '../core/storage-signal/read-value.js';
import { StorageSignalOptions } from '../types.js';
import { MemoryStorage } from '../core/memory-storage.js';

const RESERVED_KEYS_PATTERN = /^(__typed-storage__|__typed-storage-schema__|.*__route-once__)$/;

function matchesPrefix(key: string, prefix: string): boolean {
    if (RESERVED_KEYS_PATTERN.test(key)) return false;

    if (prefix === '') {
        // Sin prefix no hay separador ':' que buscar —
        // solo excluimos las keys internas reservadas
        return true;
    }

    return key.startsWith(`${prefix}:`);
}

export function applyMigrations(
    prefix: string,
    currentVersion: number,
    migrations: Record<number, (data: any) => any>,
    storage: Storage | MemoryStorage,
    options?: StorageSignalOptions
): void {
    const versionKey = `${prefix}__version__`;
    const savedVersion = storage.getItem(versionKey);

    if (!savedVersion) {
        storage.setItem(versionKey, String(currentVersion));
        return;
    }

    let version = parseInt(savedVersion);

    if (version >= currentVersion) return;

    const currentData: any = {};

    for (let i = 0; i < storage.length; i++) {
        const key = storage.key(i);

        if (key && matchesPrefix(key, prefix) && key !== versionKey) {
            const rawValue = storage.getItem(key);

            if (rawValue) {
                let processedValue = rawValue;

                if (options?.encrypt && options?.secret) {
                    try {
                        processedValue = xorDecrypt(processedValue, options.secret);
                    } catch {
                        processedValue = '';
                    }
                }

                if (options?.compress && processedValue) {
                    processedValue = LZString.decompressFromBase64(processedValue);
                }

                const item = safeParseJSON(processedValue, undefined);
                const cleanKey = prefix ? key.replace(`${prefix}:`, '') : key;
                currentData[cleanKey] = item.value;
            }
        }
    }

    while (version < currentVersion) {
        const migration = migrations[version];

        if (migration) {
            const migrated = migration(currentData);
            Object.assign(currentData, migrated);
        }

        version++;
    }

    for (const [key, value] of Object.entries(currentData)) {
        const dataToStore = JSON.stringify({ value });

        let finalData = options?.compress
            ? LZString.compressToBase64(dataToStore)
            : dataToStore;

        if (options?.encrypt && options?.secret) {
            finalData = xorEncrypt(finalData, options.secret);
        }

        const fullKey = prefix ? `${prefix}:${key}` : key;
        storage.setItem(fullKey, finalData);
    }

    storage.setItem(versionKey, String(currentVersion));
}