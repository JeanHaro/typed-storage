// Opciones de Storage
export interface StorageSignalOptions {
    prefix?: string;
    storage?: 'local' | 'session';
    ttl?: number;
    sync?: boolean;
    encrypt?: boolean;
}

// Objeto reactivo con getter, setter y reset
export interface StorageSignal<T> {
    (): T,                      // Leer el valor (como signal)
    set(value: T): void;        // escribir y persistir
    reset(): void;              // volver al valor inicial
    remove(): void;             // borra la key del storage
    has(): boolean;             // verifica si existe en storage
    onChange(callback: ( value: T ) => void): void;
}

// El schema que el usuario define
export type StorageSchema = Record<string, any>;

// El resultado de createStorage - mapea cada key a su StorageSignal
export type StorageResult<T extends StorageSchema> = {
    [K in keyof T]: StorageSignal<T[K]>
} & {
    clear(): void;
}