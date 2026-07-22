import { beforeEach, describe, expect, it } from 'vitest';
import { createStorage } from './create-storage';
import { computed } from './computed';

describe('computed', () => {
    beforeEach(() => localStorage.clear());

    it('debe combinar dos signals en un valor derivado', () => {
        const storage = createStorage({
            firstName: 'Jean',
            lastName: 'Haro'
        }, { prefix: 'computed-test' });

        const fullName = computed(
            [storage.firstName, storage.lastName],
            ( first, last ) => `${first} ${last}`
        );

        expect(fullName()).toBe('Jean Haro');
    });

    it('debe recalcularse cuando cambian los signals base', () => {
        const storage = createStorage({
            firstName: 'Jean',
            lastName: 'Haro'
        }, { prefix: 'computed-recalc' });

        const fullName = computed(
            [storage.firstName, storage.lastName],
            ( first, last ) => `${first} ${last}`
        );

        storage.firstName.set('Jeanpierre');

        expect(fullName()).toBe('Jeanpierre Haro');
    });

    it('debe funcionar con lógica más compleja (suma de un carrito)', () => {
        const storage = createStorage({
            items: [] as { price: number; quantity: number }[]
        }, { prefix: 'computed-cart' });

        const total = computed(
            [storage.items],
            (items) => items.reduce( ( sum, item ) => 
                sum + item.price * item.quantity,
                0
            )
        );

        expect(total()).toBe(0);

        storage.items.set([{ price: 10, quantity: 2 }]);
        expect(total()).toBe(20);

        storage.items.set([{ price: 10, quantity: 5 }]);
        expect(total()).toBe(50);
    });
});