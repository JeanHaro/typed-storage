import LZString from 'lz-string';
import { xorEncrypt, xorDecrypt } from './xor.js';
import { safeParseJSON } from '../core/storage-signal/read-value.js';
import { StorageSignalOptions } from '../types.js';

export function applyMigrations(
    prefix: string,
    currentVersion: number,
    migrations: Record<number, (data: any) => any>,
    storage: Storage,
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

        if (key && key.startsWith(prefix) && key !== versionKey) {
            const rawValue = storage.getItem(key);

            if (rawValue) {
                let processedValue = rawValue;

                // Desencriptamos
                if (options?.encrypt && options?.secret) {
                    try {
                        processedValue = xorDecrypt(processedValue, options.secret);
                    } catch {
                        processedValue = '';
                    }
                }

                // Descomprimimos
                if (options?.compress && processedValue) {
                    processedValue = LZString.decompressFromBase64(processedValue);
                }

                // Desempaquetamos el formato {value, expiresAt, updatedAt}
                const item = safeParseJSON(processedValue, undefined);
                const cleanKey = key.replace(`${prefix}:`, '');
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

    // Guardamos los datos migrados, re-empaquetando y re-protegiendo cada uno
    for (const [key, value] of Object.entries(currentData)) {
        const dataToStore = JSON.stringify({ value });

        let finalData = options?.compress
            ? LZString.compressToBase64(dataToStore)
            : dataToStore;

        if (options?.encrypt && options?.secret) {
            finalData = xorEncrypt(finalData, options.secret);
        }

        storage.setItem(`${prefix}:${key}`, finalData);
    }

    storage.setItem(versionKey, String(currentVersion));
}