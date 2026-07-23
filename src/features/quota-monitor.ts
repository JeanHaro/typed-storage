const ESTIMATED_LIMIT_BYTES = 5 * 1024 * 1024; // 5MB

export function calculateStorageUsage ( sto: Storage ): number {
    let totalChars = 0;

    for ( let i = 0; i < sto.length; i++ ) {
        const key = sto.key(i);

        if ( key ) {
            const value = sto.getItem(key) ?? '';
            totalChars += key.length + value.length;
        }
    }

    return totalChars * 2; // aproximación UTF-16 -> bytes
}

export function getUsagePercent ( sto: Storage ): number {
    const used = calculateStorageUsage(sto);

    return Math.round((used / ESTIMATED_LIMIT_BYTES) * 100);
}