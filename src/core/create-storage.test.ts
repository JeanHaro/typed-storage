import { expect, it } from 'vitest';
import { createStorage } from './create-storage';

it('debe registrar el tipo de cada propiedad del schema', () => {
    createStorage({
        theme: 'dark',
        sidebarOpen: true,
        fontSize: 16
    }, { prefix: 'app' });

    const schemaRegistry = JSON.parse(localStorage.getItem('__typed-storage-schema__')!);
    
    expect(schemaRegistry.app).toEqual({
        theme: 'string',
        sidebarOpen: 'boolean',
        fontSize: 'number'
    });
});