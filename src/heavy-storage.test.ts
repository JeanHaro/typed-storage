import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHeavyStorage } from './heavy-storage.js';

describe('createHeavyStorage', () => {

    it('debe retornar el initialValue si no hay datos guardados', async () => {
        // crea heavyStorage con dbName único para este test
        const heavyStorage = createHeavyStorage({
            documents: [],
            userPhotos: []
        }, {
            dbName: 'test-heavy-storage'
        });

        // verifica que get() retorna el initialValue
        const result = await heavyStorage.documents.get();
        expect(result).toEqual([]);
    });

    it('debe guardar y leer un valor con set/get', async () => {
        // crea heavyStorage
        const heavyStorage = createHeavyStorage({
            documents: [] as any[]
        }, {
            dbName: 'test-db-2'
        });


        // llama set() con un valor
        const newDocs = [{ id: 1, name: 'Doc 1' }];
        await heavyStorage.documents.set(newDocs);

        // verifica que get() retorna ese valor
        const result = await heavyStorage.documents.get();
        expect(result).toEqual(newDocs);
    });

    it('debe eliminar un valor con remove()', async () => {
        // crea heavyStorage, set() un valor
        const heavyStorage = createHeavyStorage({
            documents: [] as any[]
        }, {
            dbName: 'test-db-3'
        });
        await heavyStorage.documents.set([{ id: 1, name: 'Doc 1' }]);

        // llama remove()
        await heavyStorage.documents.remove();

        // verifica que get() retorna el initialValue
        const result = await heavyStorage.documents.get();
        expect(result).toEqual([]);
    });

    it('debe notificar a onChange cuando se llama set()', async () => {
        // usa vi.fn() como callback
        const heavyStorage = createHeavyStorage({
            documents: [] as any[]
        }, {
            dbName: 'test-db-4'
        });
        const callback = vi.fn();

        // registra onChange
        heavyStorage.documents.onChange(callback);

        // llama set()
        const newDocs = [{ id: 1, name: 'Doc 1' }];
        await heavyStorage.documents.set(newDocs);

        // verifica que el callback fue llamado con el valor correcto
        expect(callback).toHaveBeenCalledWith(newDocs);
    });

    it('clear() debe resetear todas las keys del schema', async () => {
        // crea heavyStorage con 2 keys
        const heavyStorage = createHeavyStorage({
            documents: [] as any[],
            userPhotos: [] as any[]
        }, {
            dbName: 'test-db-5'
        });

        // set() en ambas
        await heavyStorage.documents.set([{ id: 1 }]);
        await heavyStorage.userPhotos.set([{ url: 'photo.jpg' }]);

        // llama clear()
        await heavyStorage.clear();

        // verifica que ambas vuelven a su initialValue
        const docs = await heavyStorage.documents.get();
        const photos = await heavyStorage.userPhotos.get();

        expect(docs).toEqual([]);
        expect(photos).toEqual([]);
    });

});