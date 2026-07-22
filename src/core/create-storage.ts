// Types
import { 
    StorageSchema, 
    StorageResult, 
    StorageSignalOptions 
} from '../types.js';

// Storage Signal
import { createStorageSignal } from './storage-signal.js';

// Validaciones
import { validateOptions } from './validate-options.js';

// Migraciones
import { applyMigrations } from '../features/migrations.js';

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
            sto
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

    result.clear = () => {
        for ( let key of keys ) {
            result[key].reset(); // Limpiamos todas las keys del schema
        }
    }

    result.destroy = () => {
        for (let key of keys) {
            result[key].remove(); 
        }
    }

    result.batch = (values: Partial<T>) => {
        for (const key of Object.keys(values)) {
            if (result[key]) {
                result[key].set((values as any)[key]);
            }
        }
    }

    return result as StorageResult<T>;
}