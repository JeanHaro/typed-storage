import { StorageSignal } from "../types.js";

export function computed<T extends any[], R>(
    signals: { [K in keyof T]: StorageSignal<T[K]> },
    compute: ( ...values: T ) => R
): () => R {
    return () => {
        const values = signals.map(signal => signal()) as T
        return compute(...values);
    }
}