import { describe, it, expect, beforeEach } from 'vitest';
import LZString from 'lz-string';
import { applyMigrations } from './migrations.js';
import { xorEncrypt } from './xor.js';

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
        // Guarda datos con versión 2 ya guardada, en formato wrapper real
        localStorage.setItem('app__version__', '2');
        localStorage.setItem('app:theme', JSON.stringify({ value: 'dark' }));

        applyMigrations('app', 2, {
            1: (oldData) => ({
                theme: 'light'
            })
        }, localStorage);

        // El theme no debe haber cambiado - la migración no se ejecutó
        expect(localStorage.getItem('app:theme')).toBe(JSON.stringify({ value: 'dark' }));
        expect(localStorage.getItem('app__version__')).toBe('2');
    });

    it('debe aplicar migración de v1 a v2', () => {
        // Guarda datos v1 en formato wrapper — como los guardaría un signal real
        localStorage.setItem('app__version__', '1');
        localStorage.setItem('app:theme', JSON.stringify({ value: 'dark' }));
        localStorage.setItem('app:fontSize', JSON.stringify({ value: 16 }));

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

        const theme = JSON.parse(localStorage.getItem('app:theme')!);
        expect(theme.value).toBe('dark');

        const preferences = JSON.parse(localStorage.getItem('app:preferences')!);
        expect(preferences.value).toEqual({ fontSize: 16, language: 'es' });
    });

    it('debe aplicar migraciones encadenadas v1 -> v2 -> v3', () => {
        // Guarda datos v1 en formato wrapper
        localStorage.setItem('app__version__', '1');
        localStorage.setItem('app:theme', JSON.stringify({ value: 'dark' }));
        localStorage.setItem('app:fontSize', JSON.stringify({ value: 16 }));

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
        expect(preferences.value).toEqual({
            fontSize: 16,
            language: 'es',
            sidebarOpen: true
        });
    });

    it('debe funcionar correctamente con compress y encrypt activos', () => {
        const options = {
            compress: true,
            encrypt: true,
            secret: 'mi-clave'
        };

        // Simula datos v1 guardados con compress+encrypt reales
        // (usamos la misma lógica que storage-signal.ts usaría)
        function saveProtected(key: string, value: any) {
            const dataToStore = JSON.stringify({ value });
            let finalData = LZString.compressToBase64(dataToStore);
            finalData = xorEncrypt(finalData, options.secret);
            localStorage.setItem(key, finalData);
        }

        localStorage.setItem('secure__version__', '1');
        saveProtected('secure:theme', 'dark');
        saveProtected('secure:fontSize', 16);

        applyMigrations('secure', 2, {
            1: (oldData) => ({
                theme: oldData.theme,
                preferences: {
                    fontSize: oldData.fontSize,
                    language: 'es'
                }
            })
        }, localStorage, options as any);

        expect(localStorage.getItem('secure__version__')).toBe('2');

        // Los datos migrados deben seguir protegidos (comprimidos + encriptados)
        const rawStored = localStorage.getItem('secure:preferences');
        expect(rawStored).not.toContain('fontSize');
        expect(rawStored).not.toContain('16');
    });
});