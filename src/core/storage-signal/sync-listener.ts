import LZString from 'lz-string';

import { safeParseJSON } from "./read-value.js";

// Xor
import { xorDecrypt } from "../../features/xor.js";

// Interfaces
import { StorageSignalOptions } from "../../types.js";


export function setupSyncListener<T>(
    key: string,
    initialValue: T,
    options: StorageSignalOptions | undefined,
    setCurrentValue: (value: T) => void,
    notify: (value: T) => void,
    getCurrentUpdatedAt: () => number | undefined
): void {
    if ( !options?.sync ) return;

    window.addEventListener(
        'storage',
        (event: StorageEvent) => {
            if ( event.key !== key ) return;

            if ( event.newValue === null ) {
                setCurrentValue(initialValue);
                notify(initialValue);
                return;
            }

            let rawNewValue = event.newValue;

            // Desencriptamos
            if ( options?.encrypt && options?.secret ) {
                try {
                    rawNewValue = xorDecrypt(rawNewValue, options.secret);
                } catch {
                    rawNewValue = '';
                }
            }

            // Descomprimimos
            if ( options?.compress && rawNewValue ) {
                rawNewValue = LZString.decompressFromBase64(rawNewValue);
            }

            const item = safeParseJSON(rawNewValue, initialValue);

            // Conflict resolution, solo si está activado
            if ( options?.conflictResolution === 'timestamp' ) {
                const localUpdatedAt = getCurrentUpdatedAt() ?? 0;
                const remoteUpdatedAt = item.updatedAt ?? 0;

                if ( remoteUpdatedAt < localUpdatedAt ) {
                    // El cambio remoto es mas antiguo, lo ignoramos
                    return;
                }
            }

            setCurrentValue(item.value as T);
            notify(item.value as T);
        }
    );
}