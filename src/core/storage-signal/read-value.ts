import LZString from 'lz-string';

// Memory
import { MemoryStorage } from "../memory-storage.js";

// xor
import { xorDecrypt } from "../../features/xor.js";

// Interfaces
import { StorageSignalOptions } from "../../types.js";
export interface StoredValue<T> {
    value: T;
    expiresAt?: number;
    updatedAt?: number;
}

export function safeParseJSON<T>(
    value: string,
    fallback: T
): StoredValue<T> {
    if ( !value ) return { value: fallback };

    try {
        const parsed = JSON.parse(value);

        if ( parsed && typeof parsed === 'object' && 'value' in parsed ) {
            return parsed as StoredValue<T>;
        }

        return {
            value: JSON.parse(value) as T
        };
    } catch (error) {
        console.warn(`Error al parsear JSON de localStorage. Usando valor por defecto.`, error);

        return { value: fallback };
    }
}

export function readInitialValue<T>(
    key: string,
    initialValue: T,
    sto: Storage | MemoryStorage,
    options?: StorageSignalOptions
): { currentValue: T; hadSavedData: boolean } {
    const rawData = sto.getItem(key);
    let savedData = rawData;

    // Desencriptamos
    if ( options?.encrypt && options?.secret && savedData ) {
        try {
            savedData = xorDecrypt(savedData, options.secret);
        } catch {
            savedData = null;
        }
    }

    // Descomprimimos
    if ( options?.compress && savedData ) {
        savedData = LZString.decompressFromBase64(savedData);
    }

    const item = safeParseJSON(savedData!, initialValue);
    let currentValue: T;

    if ( item.expiresAt === undefined ) {
        currentValue = !savedData ? initialValue : item.value;
    } else {
        if ( Date.now() <= item.expiresAt! ) {
            currentValue = item.value;
        } else {
            sto.removeItem(key);
            currentValue = initialValue;
        }
    }

    return {
        currentValue,
        hadSavedData: !!savedData
    };
}