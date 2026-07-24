import { StorageSignalOptions } from "../types.js";

export function validateOptions ( options?: StorageSignalOptions ): string[] {
    const errors: string[] = [];

    if ( options?.encrypt && !options?.secret ) {
        errors.push('encrypt está activado pero falta "secret"');
    }

    if ( options?.version && !options?.migrations ) {
        errors.push('version está definida pero falta "migrations"')
    }

    if ( options?.ttl !== undefined && options.ttl < 0 ) {
        errors.push('ttl no puede ser negativo');
    }

    if ( 
        options?.quotaThreshold !== undefined && 
        (options.quotaThreshold < 0 || options.quotaThreshold > 100) 
    ) {
        errors.push('quotaThreshold debe estar entre 0 y 100');
    }

    return errors;
}