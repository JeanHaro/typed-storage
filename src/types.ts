export interface Plugin {
    onCreate?: ( schema: StorageSchema, options?: StorageSignalOptions ) => void;
    onSet?: ( key: string, newValue: any, oldValue: any ) => void;
    onRemove?: ( key: string ) => void;
    onReset?: ( key: string ) => void;
}

// Aceptamos cualquier "validator"
export interface Validator {
    safeParse(value: any): { success: boolean, error?: any }
}

// Opciones de Storage
export interface StorageSignalOptions {
    prefix?: string;
    storage?: 'local' | 'session';
    ttl?: number;
    sync?: boolean;
    encrypt?: boolean;
    secret?: string; // Requerido si el encrypt es true
    version?: number;
    migrations?: Record<number, ( data: any ) => any>;
    compress?: boolean;
    routeOverrides?: Record<string, Record<string, any> & { __once?: boolean }>;
    validate?: Record<string, Validator>;
    onQuotaWarning?: ( percentUsed: number ) => void;
    quotaThreshold?: number; // default 80
    conflictResolution?: 'last-write-wins' | 'timestamp'; // default: 'last-write-wins'
    plugins?: Plugin[];
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
    destroy(): void;
    batch(values: Partial<T>): void;
    setRoute(route: string): void;
    archive(): Promise<void>;
    restore(): Promise<void>;
}