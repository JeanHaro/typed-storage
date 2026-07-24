import LZString from 'lz-string';

// Types
import { 
    StorageSchema, 
    StorageResult, 
    StorageSignalOptions 
} from '../types.js';

// Storage Signal
import { createStorageSignal } from './storage-signal/storage-signal.js';

// Validaciones
import { validateOptions } from './validate-options.js';

// Migraciones
import { applyMigrations } from '../features/migrations.js';

// IndexedDB
import { 
    dbDelete, 
    dbGet, 
    dbSet, 
    openDB 
} from '../features/heavy-storage/indexeddb-driver.js';

// Xor
import { xorDecrypt } from '../features/xor.js';


function registerSchema (
    prefix: string, 
    schema: any, 
    sto: Storage
): void {
    const schemaKey = '__typed-storage-schema__';
    const existing = sto.getItem(schemaKey);
    const allSchemas: Record<string, any> = existing ? JSON.parse(existing) : {};

    const typeMap: Record<string, string> = {};
    for (const key of Object.keys(schema)) {
        typeMap[key] = typeof schema[key];
    }

    allSchemas[prefix] = typeMap;
    sto.setItem(schemaKey, JSON.stringify(allSchemas));
}

function registerPrefix (
    prefix: string,
    sto: Storage
): void {
    const registryKey = '__typed-storage__';
    const existing = sto.getItem(registryKey);
    const prefixes: string[] = existing ? JSON.parse(existing) : [];

    if ( prefix && !prefixes.includes(prefix) ) {
        prefixes.push(prefix);
        sto.setItem(registryKey, JSON.stringify(prefixes));
    }
}

export function createStorage<T extends StorageSchema>(
    schema: T,
    options?: StorageSignalOptions
): StorageResult<T> {
    const errors = validateOptions(options);
    if ( errors.length > 0 ) {
        throw new Error(`typed-storage: opciones inválidas:\n- ${errors.join('\n- ')}`);
    }

    // Migraciones
    if ( options?.version && options.migrations ) {
        const sto = options.storage === 'session' ? sessionStorage : localStorage;
        const prefix = options.prefix ?? '';

        applyMigrations(
            prefix,
            options.version,
            options.migrations,
            sto,
            options
        );
    }

    // Registramos el prefix en localStorage
    const sto = options?.storage === 'session' ? sessionStorage : localStorage;
    registerPrefix(options?.prefix ?? '', sto);
    registerSchema(options?.prefix ?? '', schema, sto);

    const result: any = [];

    let keys = Object.keys(schema);
    for ( let key of keys ) {
        result[key] = createStorageSignal(key, schema[key], options)
    }

    // Dispara onCreate para cada plugin registrado
    options?.plugins?.forEach( plugin => {
        plugin.onCreate?.(schema, options);
    });

    result.clear = () => {
        for ( let key of keys ) {
            result[key].reset(); // Limpiamos todas las keys del schema
        }
    }

    result.destroy = () => {
        for (let key of keys) {
            result[key].remove(); 
        }

        // Limpia también el registro de __once para este prefix
        const onceKey = `${options?.prefix ?? ''}__route-once__`;
        sto.removeItem(onceKey);
    }

    result.batch = (values: Partial<T>) => {
        for (const key of Object.keys(values)) {
            if (result[key]) {
                result[key].set((values as any)[key]);
            }
        }
    }

    result.setRoute = (route: string) => {
        const overrides = options?.routeOverrides?.[route];

        if (!overrides) return;

        const onceKey = `${options?.prefix ?? ''}__route-once__`;
        const usedOnces: string[] = JSON.parse(sto.getItem(onceKey) ?? '[]');

        for (const key of Object.keys(overrides)) {
            if (key === '__once') continue; // es una bandera, no un dato real

            if (result[key]) {
                const value = overrides[key];
                const isOnce = overrides.__once === true;
                const onceId = `${route}:${key}`;

                if (isOnce && usedOnces.includes(onceId)) {
                    continue; // ya se aplicó una vez, no reaplicar
                }

                if (value === null) {
                    result[key].remove();
                } else {
                    result[key].set(value);
                }

                if (isOnce) {
                    usedOnces.push(onceId);
                    sto.setItem(onceKey, JSON.stringify(usedOnces));
                }
            }
        }
    }

    result.archive = async () => {
        const db = await openDB('typed-storage-archive');

        for (const key of keys) {
            const rawValue = sto.getItem(
                options?.prefix ? `${options.prefix}:${key}` : key
            );

            if (rawValue) {
                await dbSet(db, `${options?.prefix ?? ''}:${key}`, rawValue);
                result[key].remove(); // libera espacio real en localStorage
            }
        }
    };

    result.restore = async () => {
        const db = await openDB('typed-storage-archive');

        for (const key of keys) {
            const archiveKey = `${options?.prefix ?? ''}:${key}`;
            const rawValue = await dbGet(db, archiveKey);

            if (rawValue) {
                let processedValue = rawValue;

                // Desencriptamos
                if ( options?.encrypt && options?.secret ) {
                    try {
                        processedValue = xorDecrypt(processedValue, options.secret);
                    } catch {
                        processedValue = '';
                    }
                }

                // Descomprimimos
                if ( options?.compress && processedValue ) {
                    processedValue = LZString.decompressFromBase64(processedValue);
                }

                // Parseamos el valor ya desencriptado/descomprimido
                const parsed = JSON.parse(processedValue);
                const actualValue = parsed.value !== undefined ? parsed.value : parsed;
                result[key].set(actualValue); 
                await dbDelete(db, archiveKey);
            }
        }
    };

    return result as StorageResult<T>;
}