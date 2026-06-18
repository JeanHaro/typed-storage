// Types
import { StorageSchema, StorageResult, StorageSignalOptions } from './types.js';

// Storage Signal
import { createStorageSignal } from './storage-signal.js';

// Migraciones
import { applyMigrations } from './migrations.js';

export function createStorage<T extends StorageSchema>(
    schema: T,
    options?: StorageSignalOptions
): StorageResult<T> {
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

    if ( options?.encrypt ) {
        console.warn(`
⚠️  typed-storage: la opción encrypt está activada.

Encriptar valores en localStorage no es seguro — 
la clave vive en el frontend y cualquier dev puede accederla.

Para datos sensibles usa:
    ✅ httpOnly cookies (tokens, sesiones)
    ✅ Variables de entorno en el servidor
  
typed-storage es ideal para:
    ✅ Preferencias de UI (theme, language)
    ✅ Estado de navegación
    ❌ Tokens de autenticación
    ❌ Datos financieros o personales sensibles
        `);
    }

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

    return result as StorageResult<T>;
}