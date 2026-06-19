import { describe, it, expect, beforeEach } from 'vitest';
import { applyMigrations } from './migrations';

describe('applyMigrations', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('debe guardar la versión inicial si no hay datos previos', () => {
        applyMigrations('app', 2, {
            1: (oldData) => ({
                theme: oldData.theme,
                preferences: {
                    fontSize: oldData.fontSize,
                    language: 'es'
                }
            })
        }, localStorage);
        
        const valor = localStorage.getItem('app__version__');

        expect(valor).toBe('2');
    });

    it('no debe hacer nada si la versión es igual', () => {
        // Guarda datos con versión 2 ya guardada
        localStorage.setItem('app__version__', '2');
        localStorage.setItem('app:theme', '"dark"');

        applyMigrations('app', 2, {
            1: (oldData) => ({
                theme: 'light'
            })
        }, localStorage);

        // El theme no debe haber cambiado - la migración no se ejecutó
        expect(localStorage.getItem('app:theme')).toBe('"dark"');
        expect(localStorage.getItem('app__version__')).toBe('2');
    });

    it('debe aplicar migración de v1 a v2', () => {
        // Guarda datos v1 en localStorage
        localStorage.setItem('app__version__', '1');
        localStorage.setItem('app:theme', '"dark"');
        localStorage.setItem('app:fontSize', '16');

        applyMigrations('app', 2, {
            1: (oldData) => ({
                theme: oldData.theme,
                preferences: {
                    fontSize: oldData.fontSize,
                    language: 'es'
                }
            })
        }, localStorage);

        // Verifica que los datos fueron migrados correctamente
        expect(localStorage.getItem('app__version__')).toBe('2');
        expect(localStorage.getItem('app:theme')).toBe('"dark"');

        const preferences = JSON.parse(localStorage.getItem('app:preferences')!);
        expect(preferences).toEqual({ fontSize: 16, language: 'es' });
    });

    it('debe aplicar migraciones encadenadas v1 -> v2 -> v3', () => {
        // Guarda datos v1
        localStorage.setItem('app__version__', '1');
        localStorage.setItem('app:theme', '"dark"');
        localStorage.setItem('app:fontSize', '16');

        applyMigrations('app', 3, {
            // v1 -> v2: mueve fontSize a preferences
            1: (oldData) => ({
                theme: oldData.theme,
                preferences: {
                    fontSize: oldData.fontSize,
                    language: 'es'
                }
            }),
            // v2 -> v3: añade sidebarOpen a preferences
            2: (oldData) => ({
                ...oldData,
                preferences: {
                    ...oldData.preferences,
                    sidebarOpen: true
                }
            })
        }, localStorage);

        // Verifica versión final
        expect(localStorage.getItem('app__version__')).toBe('3');

        // Verifica datos finales
        const preferences = JSON.parse(localStorage.getItem('app:preferences')!);
        expect(preferences).toEqual({
            fontSize: 16,
            language: 'es',
            sidebarOpen: true
        });
    });
})