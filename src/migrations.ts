export function applyMigrations(
    prefix: string,
    currentVersion: number,
    migrations: Record<number, ( data: any ) => any>,
    storage: Storage
): void {
    const versionKey = `${prefix}__version__`;
    const savedVersion = storage.getItem(versionKey);

    // Si no hay versión, colocamos datos nuevos, guardamos versión actual y salimos
    if ( !savedVersion ) {
        storage.setItem(versionKey, String(currentVersion));
        return;
    }

    let version = parseInt(savedVersion);

    // Si ya esta en la versión actual, no hacemos nada
    if ( version >= currentVersion ) return;

    // Leemos todos los datos actuales
    const currentData: any = {};

    // Iteramos las keys del storage que empiecen con el prefix
    for ( let i = 0; i < storage.length; i++ ) {
        const key = storage.key(i);

        if (key && key.startsWith(prefix) && key !== versionKey ) {
            const value = storage.getItem(key);

            if ( value ) {
                // quitamos el prefix para obtener el nombre real de la key
                const cleanKey = key.replace(`${prefix}:`, '');
                currentData[cleanKey] = JSON.parse(value);
            }
        }
    }

    // Aplica migraciones en orden
    while ( version < currentVersion ) {
        const migration = migrations[version];

        if ( migration ) {
            const migrated = migration(currentData);

            // Actualizamos currentData con los datos migrados
            Object.assign(currentData, migrated);
        }

        version++;
    }

    // Guardamos los datos migrados
    for ( const [key, value] of Object.entries(currentData) ) {
        storage.setItem(`${prefix}:${key}`, JSON.stringify(value));
    }

    // Actualizamos la versión
    storage.setItem(versionKey, String(currentVersion));
}