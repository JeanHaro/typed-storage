import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStorageSignal } from './storage-signal.js';

describe('createStorageSignal', () => {
     // Limpia localStorage antes de cada test
    beforeEach(() => {
        localStorage.clear();
    });

    it('debe retornar el initialValue si no hay nada en localStorage', () => {
        // 1. ARRANGE — preparas los datos
        const signal = createStorageSignal('theme', 'dark');
        
        // 2. ACT — ejecutas la acción
        const value = signal();

        // 3. ASSERT — verificas el resultado
        expect(value).toBe('dark');
    });

    it('debe guardar el valor en localStorage al llamar set()', () => {
        const theme = createStorageSignal('theme', 'dark');
        
        theme.set('light');
        expect(localStorage.getItem('theme')).not.toBeNull(); // que exista
    });

    it('debe volver al initialValue al llamar reset()', () => {
        const theme = createStorageSignal('theme', 'dark');
        theme.set('light');
        theme.reset();

        expect(theme()).toBe('dark'); // Debe ser dark
    });

    it('debe aplicar el prefix a la key en localStorage', () => {
        const theme = createStorageSignal('theme', 'dark', { prefix: 'app' });
        theme.set('light');
        
        expect(localStorage.getItem('app:theme')).not.toBeNull(); // que exista
        expect(localStorage.getItem('theme')).toBeNull(); // que no exista
    });
});

describe('has y remove', () => {
    beforeEach(() => localStorage.clear());

    it('has() debe retornar true si la key existe', () => {
        const theme = createStorageSignal('theme', 'dark');
        theme.set('light');
        expect(theme.has()).toBeTruthy();
    });

    it('has() debe retornar false si la key no existe', () => {
        const theme = createStorageSignal('theme', 'dark');
        
        expect(theme.has()).toBeFalsy();
    });

    it('remove() debe eliminar la key del localStorage', () => {
        const theme = createStorageSignal('theme', 'dark');
        theme.set('light');
        theme.remove();
        expect(localStorage.getItem('theme')).toBeNull();
        expect(theme()).toBe('dark');
    });
});

describe('onChange', () => {
    beforeEach(() => localStorage.clear());

    it('debe llamar el callback cuando se llama set()', () => {
        const theme = createStorageSignal('theme', 'dark');
        const callback = vi.fn();
        theme.onChange(callback);
        theme.set('light');
        expect(callback).toHaveBeenCalledWith('light');
    });

    it('debe llamar el callback cuando se llama reset()', () => {
        const theme = createStorageSignal('theme', 'dark');
        const callback = vi.fn();
        theme.onChange(callback);
        theme.reset();
        expect(callback).toHaveBeenCalledWith('dark');
    });
});