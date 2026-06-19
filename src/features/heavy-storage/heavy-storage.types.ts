export interface HeavyStorageOptions {
    dbName?: string;
    ttl?: number;
}

export interface HeavySignal<T> {
    get(): Promise<T>;
    set(value: T): Promise<void>;
    remove(): Promise<void>;
    onChange(callback: (value: T) => void): void;
}

// ==============================================

export type HeavyStorageSchema = Record<string, any>;

export type HeavyStorageResult<T extends HeavyStorageSchema> = {
    [K in keyof T]: HeavySignal<T[K]>;
} & {
    clear(): Promise<void>;
};
