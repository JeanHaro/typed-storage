import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStorageSignal } from './storage-signal.js';
import { z } from 'zod';

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

describe('compress option', () => {
    beforeEach(() => localStorage.clear());

    it('debe comprimir y descomprimir correctamente', () => {
        const signal = createStorageSignal<{ items: any[] }>(
            'data', 
            { items: [] }, 
            { compress: true }
        );
        const bigData = { 
            items: Array.from({ length: 50 }, 
            (_, i) => ({ id: i })) 
        };
        
        signal.set(bigData);
        
        expect(signal()).toEqual(bigData);
    });

    it('el dato comprimido debe ocupar menos espacio que sin comprimir', () => {
        const compressed = createStorageSignal('data1', '', { compress: true, prefix: 'c1' });
        const uncompressed = createStorageSignal('data2', '', { prefix: 'c2' });
        
        const repetitive = 'a'.repeat(1000);
        compressed.set(repetitive);
        uncompressed.set(repetitive);
        
        const compressedSize = localStorage.getItem('c1:data1')!.length;
        const uncompressedSize = localStorage.getItem('c2:data2')!.length;
        
        expect(compressedSize).toBeLessThan(uncompressedSize);
    });
});

describe('encrypt option', () => {
    beforeEach(() => localStorage.clear());

    it('debe ofuscar el valor guardado en localStorage', () => {
        const signal = createStorageSignal('token', '', {
            encrypt: true,
            secret: 'mi-clave'
        });

        signal.set('eyJhbGciOiJIUzI1NiJ9.test.jwt');

        const rawStored = localStorage.getItem('token');
        // El valor crudo NO debe contener el JWT en texto plano
        expect(rawStored).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    });

    it('debe desencriptar correctamente al leer', () => {
        const signal = createStorageSignal('token', '', {
            encrypt: true,
            secret: 'mi-clave'
        });

        const originalValue = 'eyJhbGciOiJIUzI1NiJ9.test.jwt';
        signal.set(originalValue);

        expect(signal()).toBe(originalValue);
    });

    it('debe funcionar junto con TTL', () => {
        const signal = createStorageSignal('token', '', {
            encrypt: true,
            secret: 'mi-clave',
            ttl: 1000
        });

        signal.set('mi-token');
        expect(signal()).toBe('mi-token');
    });
});

// Validations
describe('validate option', () => {
    beforeEach(() => localStorage.clear());

    it('debe lanzar error si el valor no pasa la validación de Zod', () => {
        const emailSignal = createStorageSignal('email', '', {
            validate: {
                email: z.string().email()
            }
        });

        expect(() => {
            emailSignal.set('esto-no-es-un-email');
        }).toThrow(/valor inválido/);
    });

    it('debe permitir el set si el valor SÍ pasa la validación', () => {
        const emailSignal = createStorageSignal('email', '', {
            validate: {
                email: z.string().email()
            }
        });

        expect(() => {
            emailSignal.set('jean@gmail.com');
        }).not.toThrow();

        expect(emailSignal()).toBe('jean@gmail.com');
    });

    it('sin validate, cualquier valor pasa sin restricción', () => {
        const signal = createStorageSignal('theme', 'dark');

        expect(() => {
            signal.set('cualquier-cosa');
        }).not.toThrow();
    });

    it('debe validar con reglas numéricas (min/max)', () => {
        const ageSignal = createStorageSignal('age', 0, {
            validate: {
                age: z.number().min(0).max(120)
            }
        });

        expect(() => ageSignal.set(-5)).toThrow(/valor inválido/);
        expect(() => ageSignal.set(200)).toThrow(/valor inválido/);
        expect(() => ageSignal.set(30)).not.toThrow();
    });
});

// Quota
describe('onQuotaWarning', () => {
    beforeEach(() => localStorage.clear());

    it('debe llamar onQuotaWarning cuando se supera el threshold', () => {
        const onQuotaWarning = vi.fn();

        const signal = createStorageSignal('bigData', '', {
            onQuotaWarning,
            quotaThreshold: 0 // umbral en 0% para forzar que dispare siempre
        });

        signal.set('cualquier valor');

        expect(onQuotaWarning).toHaveBeenCalled();
    });

    it('no debe llamar onQuotaWarning si no se supera el threshold', () => {
        const onQuotaWarning = vi.fn();

        const signal = createStorageSignal('smallData', '', {
            onQuotaWarning,
            quotaThreshold: 100 // umbral altísimo, casi imposible de alcanzar
        });

        signal.set('valor pequeño');

        expect(onQuotaWarning).not.toHaveBeenCalled();
    });

    it('sin onQuotaWarning, no debe fallar ni hacer nada especial', () => {
        const signal = createStorageSignal('data', '');

        expect(() => {
            signal.set('valor normal');
        }).not.toThrow();
    });

    it('debe recibir el porcentaje calculado como argumento', () => {
        const onQuotaWarning = vi.fn();

        const signal = createStorageSignal('data', '', {
            onQuotaWarning,
            quotaThreshold: 0
        });

        signal.set('valor');

        expect(onQuotaWarning).toHaveBeenCalledWith(expect.any(Number));
    });
});