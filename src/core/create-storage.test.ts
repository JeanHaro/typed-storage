import { expect, it, vi } from 'vitest';
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

// Test del destroy
it('destroy() debe eliminar completamente todas las keys del schema', () => {
    const storage = createStorage({
        theme: 'dark',
        fontSize: 16
    }, { prefix: 'scoped' });

    storage.theme.set('light');
    storage.fontSize.set(20);

    // Confirma que existen antes de destruir
    expect(localStorage.getItem('scoped:theme')).not.toBeNull();
    expect(localStorage.getItem('scoped:fontSize')).not.toBeNull();

    storage.destroy();

    // Después de destroy() deben desaparecer completamente
    expect(localStorage.getItem('scoped:theme')).toBeNull();
    expect(localStorage.getItem('scoped:fontSize')).toBeNull();

    // Y los signals vuelven al initialValue en memoria
    expect(storage.theme()).toBe('dark');
    expect(storage.fontSize()).toBe(16);
});

// Test del batch
it('batch() debe actualizar múltiples valores en una sola llamada', () => {
    const storage = createStorage({
        theme: 'dark',
        fontSize: 16,
        language: 'es'
    }, { prefix: 'batch-test' });

    storage.batch({
        theme: 'light',
        fontSize: 20
    });

    expect(storage.theme()).toBe('light');
    expect(storage.fontSize()).toBe(20);
    expect(storage.language()).toBe('es'); // no incluido en batch, no cambia
});

// Test del batch
it('batch() debe persistir los valores en localStorage', () => {
    const storage = createStorage({
        theme: 'dark',
        fontSize: 16
    }, { prefix: 'batch-persist' });

    storage.batch({ theme: 'light', fontSize: 20 });

    expect(localStorage.getItem('batch-persist:theme')).toContain('light');
    expect(localStorage.getItem('batch-persist:fontSize')).toContain('20');
});

// Test del batch
it('batch() debe notificar onChange por cada key actualizada', () => {
    const storage = createStorage({
        theme: 'dark',
        fontSize: 16
    }, { prefix: 'batch-notify' });

    const themeCallback = vi.fn();
    const fontSizeCallback = vi.fn();

    storage.theme.onChange(themeCallback);
    storage.fontSize.onChange(fontSizeCallback);

    storage.batch({ theme: 'light', fontSize: 20 });

    expect(themeCallback).toHaveBeenCalledWith('light');
    expect(fontSizeCallback).toHaveBeenCalledWith(20);
});

// Test de la validación
it('debe lanzar error si encrypt está activo sin secret', () => {
    expect(() => {
        createStorage({ token: '' }, { prefix: 'validate-1', encrypt: true });
    }).toThrow('encrypt está activado pero falta "secret"');
});

// Test de la validación
it('debe lanzar error si version está definida sin migrations', () => {
    expect(() => {
        createStorage({ theme: 'dark' }, { prefix: 'validate-2', version: 2 });
    }).toThrow('version está definida pero falta "migrations"');
});

// Test de la validación
it('debe lanzar error si ttl es negativo', () => {
    expect(() => {
        createStorage({ token: '' }, { prefix: 'validate-3', ttl: -100 });
    }).toThrow('ttl no puede ser negativo');
});

// Test de la validación
it('debe crear el storage normalmente si las opciones son válidas', () => {
    expect(() => {
        createStorage({ theme: 'dark' }, { prefix: 'validate-4', ttl: 1000 });
    }).not.toThrow();
});

// Test de setRoute
it('setRoute() debe aplicar el valor override de la ruta actual', () => {
    const storage = createStorage({
        theme: 'dark' as 'dark' | 'light'
    }, {
        prefix: 'route-1',
        routeOverrides: {
            '/': { theme: 'dark' },
            '/about': { theme: 'light' }
        }
    });

    storage.setRoute('/about');
    expect(storage.theme()).toBe('light');

    storage.setRoute('/');
    expect(storage.theme()).toBe('dark');
});

// Test de setRoute
it('setRoute() no debe hacer nada si la ruta no tiene overrides', () => {
    const storage = createStorage({
        theme: 'dark' as 'dark' | 'light'
    }, {
        prefix: 'route-2',
        routeOverrides: {
            '/about': { theme: 'light' }
        }
    });

    storage.theme.set('light'); // valor "normal", sin override

    storage.setRoute('/dashboard'); // ruta no mencionada en routeOverrides

    expect(storage.theme()).toBe('light'); // no cambió
});

// Test de setRoute
it('setRoute() con valor null debe eliminar la key de esa ruta', () => {
    const storage = createStorage({
        theme: 'dark' as 'dark' | 'light'
    }, {
        prefix: 'route-3',
        routeOverrides: {
            '/contact': { theme: null }
        }
    });

    storage.theme.set('light');
    expect(localStorage.getItem('route-3:theme')).not.toBeNull();

    storage.setRoute('/contact');

    expect(localStorage.getItem('route-3:theme')).toBeNull();
    expect(storage.theme()).toBe('dark'); // vuelve al initialValue
});

// Test de setRoute
it('setRoute() debe manejar múltiples keys en el mismo override', () => {
    const storage = createStorage({
        theme: 'dark' as 'dark' | 'light',
        fontSize: 16
    }, {
        prefix: 'route-4',
        routeOverrides: {
            '/settings': { theme: 'light', fontSize: 20 }
        }
    });

    storage.setRoute('/settings');

    expect(storage.theme()).toBe('light');
    expect(storage.fontSize()).toBe(20);
});

// _once
it('con __once: true, el override solo se aplica la primera vez', () => {
    const storage = createStorage({
        theme: 'dark' as 'dark' | 'light'
    }, {
        prefix: 'once-1',
        routeOverrides: {
            '/page2': { theme: 'light', __once: true }
        }
    });

    // Primera visita — se aplica el override
    storage.setRoute('/page2');
    expect(storage.theme()).toBe('light');

    // Usuario cambia manualmente
    storage.theme.set('dark');

    // Vuelve a la ruta — NO debe reaplicar el override
    storage.setRoute('/page2');
    expect(storage.theme()).toBe('dark'); // se mantiene, no vuelve a 'light'
});

// _once
it('sin __once, el override se reaplica cada vez', () => {
    const storage = createStorage({
        theme: 'dark' as 'dark' | 'light'
    }, {
        prefix: 'once-2',
        routeOverrides: {
            '/page2': { theme: 'light' } // sin __once
        }
    });

    storage.setRoute('/page2');
    expect(storage.theme()).toBe('light');

    storage.theme.set('dark');

    // Vuelve a la ruta — SÍ debe reaplicar el override
    storage.setRoute('/page2');
    expect(storage.theme()).toBe('light'); // se reimpone
});

// _once
it('con __once: true, el estado "usado" persiste en localStorage entre instancias', () => {
    const storage1 = createStorage({
        theme: 'dark' as 'dark' | 'light'
    }, {
        prefix: 'once-3',
        routeOverrides: {
            '/page2': { theme: 'light', __once: true }
        }
    });

    storage1.setRoute('/page2');
    storage1.theme.set('purple' as any);

    // Simula "recargar la página" — nueva instancia con el mismo prefix
    const storage2 = createStorage({
        theme: 'dark' as 'dark' | 'light'
    }, {
        prefix: 'once-3',
        routeOverrides: {
            '/page2': { theme: 'light', __once: true }
        }
    });

    storage2.setRoute('/page2');
    expect(storage2.theme()).toBe('purple'); // NO se reaplica, sobrevivió el "reload"
});