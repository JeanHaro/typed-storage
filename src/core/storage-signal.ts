import LZString from 'lz-string';

// Tipos
import { 
    StorageSignal, 
    StorageSignalOptions 
} from "../types.js";

// Memory
import { MemoryStorage } from "./memory-storage.js";

// Xor
import { 
    xorEncrypt, 
    xorDecrypt 
} from '../features/xor.js';

// Interface
interface StoredValue<T> {
    value: T;
    expiresAt?: number; // undefined = sin expiración
}

// Asegurar el parseo del JSON, verificamos si el valor que se obtiene es del tipo T
// Si no es del tipo T entonces retornamos el valor inicial
function safeParseJSON<T>(value: string, fallback: T): StoredValue<T> {
    if (!value) return { value: fallback };

    try {
        const parsed = JSON.parse(value);

        // Si tiene la forma StoredValue -> ya viene con TTL
        if ( parsed && typeof parsed === 'object' && 'value' in parsed ) {
            return parsed as StoredValue<T>;
        }

        // Si es un valor simple (datos sin TTL) -> envolvemos
        return { value: JSON.parse(value) as T };
    } catch (error) {
        console.warn(`Error al parsear JSON de localStorage. Usando valor por defecto.`, error);
        
        // Si hay error por el parse digamos entonces regresa el valor inicial sin TTL
        return { value: fallback };
    }
} 

// Obtenemos el valor del localStorage o SessionStorage, sino MemoryStorage
function getStorage(type: 'local' | 'session'): Storage | MemoryStorage {
    try {
        const sto = type === 'session' ? sessionStorage : localStorage;

        // Prueba que realmente funciona escribiendo y borrando
        sto.setItem('__typed_storage_test__', '1');
        sto.removeItem('__typed_storage_test__');

        return sto;
    } catch {
        console.warn('Storage no disponible, usando memoria como fallback');
        return new MemoryStorage();
    }
}

// Creamos el Storage en modo signal
export function createStorageSignal<T>(
    key: string,
    initialValue: T,
    options?: StorageSignalOptions
): StorageSignal<T> {
    // Obtenemos que tipo de storage será
    let sto = getStorage(options?.storage ?? 'local');

    // Verificamos si tiene opciones
    if ( options?.prefix ) {
        key = `${options.prefix}:${key}`;
    }

    const rawData = sto.getItem(key);
    let savedData = options?.compress && rawData 
                            ? LZString.decompress(rawData) 
                            : rawData;

    // Desencripta si encrypt está activo
    if ( options?.encrypt && options?.secret && savedData ) {
        try {
            savedData = xorDecrypt(savedData, options.secret);
        } catch {
            savedData = null; // si falla desencriptar, trata como vacío
        }
    }
    let currentValue: T;

    const listeners: Array<(value: T) => void> = [];
    function notify ( value: T ): void {
        listeners.forEach(cb => cb(value));
    }

    // Asegurarnos que el item obtenido sea de tipo StoredValue
    const item = safeParseJSON(savedData!, initialValue);

    if ( item.expiresAt === undefined ) {
        currentValue =  !savedData ? initialValue : item.value;
    } else {
        if ( Date.now() <= item.expiresAt! ) {
            currentValue = item.value;
        } else {
            sto.removeItem(key);
            currentValue = initialValue;
        }
    }

    const signalBase = function(): T {
        return currentValue;
    }

    // Verificamos si tiene sincronizacion activo
    if ( options?.sync ) {
        window.addEventListener('storage', (event: StorageEvent) => {
            // Si el key es igual a nuestro key
            if ( event.key === key ) {
                // Si el nuevo valor es null entonces se le asigna el initialValue
                if ( event.newValue === null ) {
                    notify(initialValue);
                    return  currentValue = initialValue;
                } 

                // Parseamos el nuevo valor
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

                notify(item.value as T);
                return currentValue = item.value as T;
            }
        })
    }

    signalBase.set = function ( newValue: T ): void {
        currentValue = newValue;
        notify(currentValue);
        
        const dataToStore = JSON.stringify({
            value: newValue,
            expiresAt: options?.ttl ? Date.now() + options.ttl : undefined
        });

        let finalData = options?.compress 
                                ? LZString.compress(dataToStore) 
                                : dataToStore;

        if ( options?.encrypt && options?.secret ) {
            finalData = xorEncrypt(finalData, options.secret);
        }

        sto.setItem( key, finalData );
    }

    signalBase.reset = function(): void {
        currentValue = initialValue;
        notify(currentValue);
        
        const dataToStore = JSON.stringify(initialValue);
        const finalData = options?.compress
                                ? LZString.compress(dataToStore)
                                : dataToStore;

        sto.setItem(key, finalData);
    }

    signalBase.has = function(): boolean {
        return !!sto.getItem(key);
    }

    signalBase.remove = function(): void {
        sto.removeItem(key);
        currentValue = initialValue;
        notify(currentValue);
    }

    signalBase.onChange = function(callback: (value: T) => void): void {
        listeners.push(callback);
    }

    return signalBase as StorageSignal<T>;
}
