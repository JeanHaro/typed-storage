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
    notify: (value: T) => void
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

            let rawNewValue = options?.compress
                ? LZString.decompress(event.newValue)
                : event.newValue;

            if ( options?.encrypt && options?.secret ) {
                try {
                    rawNewValue = xorDecrypt(rawNewValue, options.secret);
                } catch {
                    rawNewValue = '';
                }
            }

            const item = safeParseJSON(rawNewValue, initialValue);
            setCurrentValue(item.value as T);
            notify(item.value as T);
        }
    );
}