# typed-storage

Type-safe `localStorage` and `sessionStorage` with a signal-like API, TTL support, cross-tab sync, schema migrations, and automatic fallback to memory when storage is unavailable.

```typescript
const appStorage = createStorage({
  theme: 'dark' as 'dark' | 'light',
  language: 'es' as 'es' | 'en',
  fontSize: 16,
});

appStorage.theme.set('light');   // ✅ typed — only 'dark' | 'light' accepted
appStorage.theme.set('purple');  // ❌ TypeScript error at compile time
console.log(appStorage.theme()); // 'light' — persisted across reloads
```

---

## ✨ Features

- **Type-safe** — TypeScript infers types from your schema automatically
- **Signal-like API** — read with `signal()`, write with `signal.set(value)`
- **TTL / expiration** — keys expire automatically after a defined time
- **Cross-tab sync** — changes in one tab reflect in others via `StorageEvent`
- **Schema migrations** — safely transform data when your schema changes
- **Memory fallback** — works even when `localStorage` is unavailable (Safari private mode, quota exceeded)
- **Prefix namespacing** — avoid key collisions across apps or modules
- **sessionStorage support** — opt in per schema
- **onChange** — subscribe to value changes with a callback
- **`batch()`** — update multiple keys in a single call
- **`computed()`** — derive reactive values from one or more signals
- **`destroy()`** — completely remove scoped/temporary data
- **`routeOverrides`** — different values per route/page, with automatic sync via `setRoute()`
- **Options validation** — clear errors for invalid configuration, thrown early
- **Zero dependencies** — pure TypeScript, no external packages

---

## 📦 Installation

```bash
npm install typed-storage
# or
pnpm add typed-storage
```

---

## 🚀 Basic Usage

```typescript
import { createStorage } from 'typed-storage';

const appStorage = createStorage({
  theme: 'dark' as 'dark' | 'light',
  language: 'es' as 'es' | 'en' | 'fr',
  fontSize: 16,
  sidebarOpen: true,
});

// Read
console.log(appStorage.theme());       // 'dark'

// Write — persists to localStorage automatically
appStorage.theme.set('light');
console.log(appStorage.theme());       // 'light'

// Reset to initial value
appStorage.theme.reset();
console.log(appStorage.theme());       // 'dark'

// Check if key exists in storage
appStorage.theme.has();                // true

// Remove key from storage
appStorage.theme.remove();
appStorage.theme.has();                // false

// Subscribe to changes
appStorage.theme.onChange((newValue) => {
    console.log('theme changed to:', newValue);
});

// Clear all keys in the schema (resets to initialValue, keys still exist)
appStorage.clear();
```

---

## 📦 Batch updates

Update multiple keys in a single call instead of calling `.set()` on each one separately:

```typescript
const appStorage = createStorage({
    theme: 'dark' as 'dark' | 'light',
    fontSize: 16,
    language: 'es' as 'es' | 'en',
});

// Instead of this:
appStorage.theme.set('light');
appStorage.fontSize.set(20);
appStorage.language.set('en');

// Do this:
appStorage.batch({
    theme: 'light',
    fontSize: 20,
    language: 'en'
});
```

Useful for forms with several fields saved at once (e.g. a "Preferences" screen with a single "Save" button), where writing multiple `.set()` calls is repetitive.

```typescript
appStorage.batch({
    theme: 'light',   // updated
    fontSize: 20       // updated
    // language is not included — stays unchanged
});
```

Each updated key still fires its own `onChange` callback and persists individually.

---

## 🧮 Computed values

Derive a reactive value from one or more existing signals, without duplicating calculation logic across your code:

```typescript
import { createStorage, computed } from 'typed-storage';

const userStorage = createStorage({
    firstName: 'Jean',
    lastName: 'Haro'
});

const fullName = computed(
    [userStorage.firstName, userStorage.lastName],
    (first, last) => `${first} ${last}`
);

fullName(); // → 'Jean Haro'

userStorage.firstName.set('Jeanpierre');
fullName(); // → 'Jeanpierre Haro' — recalculated automatically
```

Another example — a cart total that always reflects the current state:

```typescript
const cartStorage = createStorage({
    items: [] as { price: number; quantity: number }[]
});

const total = computed(
    [cartStorage.items],
    (items) => items.reduce((sum, item) => sum + item.price * item.quantity, 0)
);

cartStorage.items.set([{ price: 10, quantity: 2 }]);
total(); // → 20

cartStorage.items.set([{ price: 10, quantity: 5 }]);
total(); // → 50 — recalculated automatically
```

`computed()` doesn't cache anything internally — it recomputes on every call by reading the current value of each source signal. This keeps it simple and always correct, at the cost of not being optimized for extremely hot loops.

---

## 🗑️ Scoped / temporary storage with `destroy()`

Some data only makes sense while the user is on a specific page or component — search filters, a form draft, table selection state. `destroy()` completely removes those keys from storage, unlike `reset()` (which keeps the key but resets its value) or `clear()` (which resets all keys but keeps them present).

```typescript
const searchFilters = createStorage({
    category: '',
    priceRange: [0, 100]
}, { prefix: 'products-page' });

// User filters, searches, browses...
searchFilters.category.set('electronics');

// User leaves the "Products" page
searchFilters.destroy();
// → localStorage['products-page:category'] no longer exists at all
// → coming back later starts clean
```

### `destroy()` vs `reset()` vs `clear()`

```typescript
// reset(key) — goes back to initialValue, key still exists in storage
storage.theme.reset();
// localStorage['app:theme'] = '"dark"' — still there
// storage.theme() → 'dark' (initialValue)

// destroy() (on the whole StorageResult) — removes every key completely
storage.destroy();
// localStorage['app:theme'] — no longer exists
// storage.theme() → 'dark' (initialValue, in memory only)

// clear() — calls reset() on every key in the schema
storage.clear();
// same as reset(), but for every key at once — keys still exist
```

### When to use `destroy()`

```
✅ Good for:
   - Search filters, form drafts, temporary UI state
   - Data that should always start "clean" on a fresh visit

❌ Not for:
   - Data you want to reuse between visits (use `ttl` for that instead —
     a short-lived cache that still survives navigation)
   - User preferences (theme, language) — those should persist indefinitely
```

If you want data to survive between visits but expire after a while (e.g. a product list cache), use `ttl` instead of `destroy()` — that's a "stale-while-revalidate" pattern: show the cached value immediately, then refresh it in the background.

> Automatic integration with Angular's `ngOnDestroy` / React's `useEffect` cleanup (so you don't have to call `destroy()` manually) is planned for the framework wrappers.

---

## 🧭 Different values per route with `routeOverrides`

Some values should differ depending on which page the user is on — for example, a different theme on the landing page than in the dashboard. `routeOverrides` maps routes to specific key values, applied through `setRoute()`.

```typescript
const appStorage = createStorage({
    theme: 'dark' as 'dark' | 'light',
}, {
    prefix: 'app',
    routeOverrides: {
        '/': { theme: 'dark' },
        '/about': { theme: 'light' }
    }
});

appStorage.setRoute('/about');
appStorage.theme(); // → 'light'

appStorage.setRoute('/');
appStorage.theme(); // → 'dark'
```

If the current route has no entry in `routeOverrides`, `setRoute()` does nothing — the "normal" value (whatever is currently stored) is used as-is.

### Removing a key for a specific route with `null`

Use `null` as the override value to make a key disappear from storage entirely while on that route:

```typescript
const appStorage = createStorage({
    currency: 'USD',
}, {
    prefix: 'shop',
    routeOverrides: {
        '/checkout': { currency: null } // force re-selection at checkout, for safety
    }
});

appStorage.currency.set('EUR');
appStorage.setRoute('/checkout');
// → localStorage['shop:currency'] is removed
// → appStorage.currency() returns 'USD' (the initialValue) while on this route
```

This is useful when a value should never be silently "remembered" on a specific page, even if it persists everywhere else.

### ⚠️ `null` is destructive — it's not reversible

Once `setRoute()` removes a key because of a `null` override, the previous value is gone completely — it's not "remembered" for later. Navigating to a route with no entry in `routeOverrides` does **not** restore what was there before; it simply leaves the key as whatever it currently is (removed, in this case), falling back to `initialValue`.

```typescript
routeOverrides: {
    '/contact': { theme: null }
    // '/dashboard' has no entry — no override at all
}

storage.theme.set('light');      // user picks 'light'
storage.setRoute('/contact');    // → key removed, theme() = 'dark' (initialValue)
storage.setRoute('/dashboard');  // → no override, does nothing
                                  // → but the key is STILL removed from the previous step
                                  // → theme() stays 'dark', the user's 'light' choice is lost
```

**If you use `null` for a value like `theme` that the user expects to persist across the whole app, you must set an explicit override (or none with `null`) for *every* route** — don't leave routes out, or users will silently lose their preference the moment they visit an unlisted route after visiting a `null` one.

```typescript
// ❌ Risky — only some routes have overrides, "gaps" can lose data unexpectedly
routeOverrides: {
    '/contact': { theme: null }
}

// ✅ Safe — every route is explicit, no route falls through unexpectedly
routeOverrides: {
    '/': { theme: 'dark' },
    '/about': { theme: 'dark' },
    '/contact': { theme: null },
    '/dashboard': { theme: 'dark' }
}
```

`null` is best reserved for values that are genuinely meant to be page-scoped and disposable (e.g. re-confirming currency at checkout) — not for app-wide preferences like `theme` or `language` that users expect to survive navigation everywhere.

### Applying an override only once with `__once`

By default, an override in `routeOverrides` is reapplied **every time** you navigate to that route — even if the user manually changed the value while they were there. Add `__once: true` to an override so it only applies the first time the user visits that route, and is never reimposed again afterward:

```typescript
const appStorage = createStorage({
    theme: 'dark' as 'dark' | 'light',
}, {
    prefix: 'app',
    routeOverrides: {
        '/dashboard': { theme: 'light', __once: true }
    }
});

// First visit — the override applies
appStorage.setRoute('/dashboard');
appStorage.theme(); // → 'light'

// User changes it manually
appStorage.theme.set('dark');

// Leaves and comes back to /dashboard
appStorage.setRoute('/dashboard');
appStorage.theme(); // → 'dark' — NOT reset to 'light', the override already "used up" its one application
```

`__once` doesn't restrict the user from changing the value afterward — it only stops the *automatic override* from reimposing itself. The user (or your app) can keep calling `.set()` freely, forever, exactly like any other value.

The "already applied" state is stored in `localStorage` (under a `prefix__route-once__` key), so it survives full page reloads — it's not just an in-memory flag that resets when the user refreshes the browser.

```
Without __once → the override always wins on every visit to that route
With __once     → the override only wins the first time ever;
                   after that, the value behaves like a normal signal
```

Use `__once` when you want a route to have a sensible *starting* value the first time a user lands there, but want to fully respect whatever they choose afterward — for example, defaulting `/dashboard` to `'light'` on first visit, without overriding a returning user's later choice of `'dark'` or any other value.

### ⚠️ Important — `routeOverrides` (with or without `__once`) is always ONE shared value, never per-route isolation

This is the single most common point of confusion, so it deserves its own callout: **`routeOverrides` always operates on the *same* key** (e.g. `app:theme`), regardless of which route you're on. Whether or not you use `__once`, there is still only **one** `theme` value shared across your entire app — `routeOverrides` only controls *when that one shared value gets overwritten automatically*, never whether different routes get their own independent copies.

If what you actually want is for `/home` and `/about` to each keep their **own, fully independent** value — where changing one never affects the other, no matter what — `routeOverrides` is the wrong tool entirely, even with `__once`. Use a separate `prefix` per page instead:

```typescript
// Home page — its own isolated storage
const homeStorage = createStorage({ theme: 'dark' as 'dark' | 'light' }, { prefix: 'home' });

// About page — a completely separate isolated storage
const aboutStorage = createStorage({ theme: 'light' as 'dark' | 'light' }, { prefix: 'about' });

// Changing homeStorage.theme never affects aboutStorage.theme, and vice versa —
// they are two entirely different localStorage keys ('home:theme' and 'about:theme')
```

### Choosing the right pattern

| You want... | Use |
|---|---|
| Each page to have its own value, totally independent, forever | Separate `prefix` per page |
| One shared app-wide value that gets **reset** to a specific value every time a route is visited | `routeOverrides` **without** `__once` |
| One shared app-wide value with a sensible *starting suggestion* per route, but the user's later choice (from any route) is respected everywhere afterward | `routeOverrides` **with** `__once: true` |
| A value to disappear entirely while on a specific route (e.g. force re-confirmation) | `routeOverrides` with `null` for that route (see the destructive-`null` warning above) |

```
prefix per page:
  home:theme = 'dark'    ← completely separate key
  about:theme = 'light'  ← completely separate key
  Changing one never touches the other. True isolation.

routeOverrides without __once:
  app:theme = ??? (one key, shared)
  Every visit to '/' forces 'dark'. Every visit to '/about' forces 'light'.
  Feels "independent" because it resets on every visit, but it's the
  SAME key being overwritten each time — a manual change is lost
  the moment you revisit an overridden route.

routeOverrides with __once:
  app:theme = ??? (one key, shared)
  '/' suggests 'dark' the first time ever, '/about' suggests 'light'
  the first time ever. After that, whatever the user sets — from
  ANY route — persists everywhere, permanently.
```

### Connecting `setRoute()` to your router

`typed-storage` doesn't know what a "route" is — you tell it, by calling `setRoute()` whenever navigation happens. This is a couple of lines of glue code specific to whichever router you use:

```typescript
// Vue Router
router.afterEach((to) => appStorage.setRoute(to.path));

// SvelteKit
import { page } from '$app/stores';
page.subscribe((p) => appStorage.setRoute(p.route.id ?? ''));

// Astro (mostly server-rendered, no SPA navigation to track)
appStorage.setRoute(Astro.url.pathname);

// Vanilla JS / no framework
window.addEventListener('popstate', () => {
    appStorage.setRoute(window.location.pathname);
});
```

For Angular and React, [@jeanharo98/typed-storage-angular](https://github.com/JeanHaro/typed-storage-angular) and [@jeanharo98/typed-storage-react](https://github.com/JeanHaro/typed-storage-react) wire this up for you automatically — see their documentation for details.

---

## ✅ Options validation

`createStorage()` validates option combinations upfront and throws a clear error instead of failing silently or behaving unexpectedly:

```typescript
createStorage({ token: '' }, { encrypt: true });
// ❌ Throws: typed-storage: opciones inválidas:
//    - encrypt está activado pero falta "secret"

createStorage({ theme: 'dark' }, { version: 2 });
// ❌ Throws: typed-storage: opciones inválidas:
//    - version está definida pero falta "migrations"

createStorage({ token: '' }, { ttl: -100 });
// ❌ Throws: typed-storage: opciones inválidas:
//    - ttl no puede ser negativo
```

This catches common misconfigurations at the moment `createStorage()` is called, rather than leaving you to debug why encryption or migrations "aren't working" later.

---

## ✅ Runtime validation with Zod (optional)

`createStorage()`'s schema-type registry (documented above) only checks the primitive JavaScript type — `string`, `number`, `boolean`, `object`. It doesn't enforce actual business rules like "this must be a valid email" or "this number must be between 0 and 120". For that, `typed-storage` supports optional runtime validation using [Zod](https://zod.dev) (or any validator with a compatible `safeParse` method — Zod isn't a hard dependency).

```typescript
import { createStorage } from 'typed-storage';
import { z } from 'zod';

const appStorage = createStorage({
    email: '',
    age: 0
}, {
    validate: {
        email: z.string().email(),
        age: z.number().min(0).max(120)
    }
});

appStorage.email.set('jean@gmail.com'); // ✅ valid, saved normally
appStorage.email.set('not-an-email');
// ❌ Throws: typed-storage: valor inválido para "email": Invalid email

appStorage.age.set(-5);
// ❌ Throws: typed-storage: valor inválido para "age": ...
```

### Zod is optional, not a hard dependency

`typed-storage` doesn't import Zod internally — it only expects the object passed to `validate[key]` to have a `safeParse(value)` method that returns `{ success: boolean, error?: any }`, which is exactly Zod's schema interface. This means:

```bash
# Install Zod yourself, only if you want to use validate
pnpm add zod
```

If you never use `validate`, `typed-storage` has zero extra bundle weight from this feature — nothing is imported unless you provide validators.

### Only keys with a `validate` entry are checked

```typescript
createStorage({
    email: '',
    theme: 'dark' as 'dark' | 'light'  // no validator provided for this key
}, {
    validate: {
        email: z.string().email()
        // theme is not listed — no validation runs for it, .set() always succeeds
    }
});
```

---

## 🔁 Automatic fallback to IndexedDB on quota exceeded

If `localStorage.setItem()` fails specifically because the browser's storage quota was exceeded (`QuotaExceededError`), `typed-storage` automatically backs up that value to IndexedDB instead of losing it or throwing an uncaught error:

```typescript
const appStorage = createStorage({
    cart: []
});

appStorage.cart.set([...hugeArrayOfProducts]);
// If localStorage is full:
// → a warning is logged
// → the value is saved to IndexedDB in the background (fire-and-forget)
// → your app doesn't crash

// On a later page load, if localStorage still has nothing for that key,
// typed-storage automatically checks IndexedDB and restores the value:
const cart = appStorage.cart(); // starts as initialValue, then updates
                                  // moments later once IndexedDB responds
```

### Why this doesn't break the synchronous API

`createStorage()` is synchronous by design — `.set()` and reading a signal never return Promises. IndexedDB is asynchronous by nature, so this fallback is implemented as "fire-and-forget in the background":

```
1. .set() always returns immediately, synchronously, as always
2. If localStorage.setItem() throws QuotaExceededError specifically:
   → a background async call saves the value to IndexedDB
   → your code doesn't wait for it, doesn't need to await anything
3. On the next createStorage() call for that key (e.g. after a page reload):
   → if localStorage has nothing, an async check against IndexedDB runs
   → if something is found, the signal updates via onChange a moment later
```

This means the restored value can appear a few milliseconds after the page loads, rather than being available instantly — a reasonable trade-off for not losing the data at all when localStorage is full. Only `QuotaExceededError` triggers this fallback; other errors from `setItem()` are re-thrown normally, since they usually indicate a real bug rather than a storage limit.

---

## 📊 Quota monitoring

`localStorage` has a limit of roughly 5-10MB per domain (it varies by browser). If you exceed it, `setItem()` throws a `QuotaExceededError` — and if unhandled, your app can silently break. `onQuotaWarning` lets you get notified **before** that happens, so you can act (clean up old data, move things to `createHeavyStorage`, warn the user, etc.):

```typescript
const appStorage = createStorage({
    cart: []
}, {
    prefix: 'shop',
    onQuotaWarning: (percentUsed) => {
        console.warn(`⚠️ localStorage is at ${percentUsed}% of its estimated capacity`);
    },
    quotaThreshold: 80 // optional, defaults to 80 (%)
});
```

`onQuotaWarning` is checked after every `.set()` call. The percentage is an **estimate** — there's no native browser API to query exact remaining quota, so `typed-storage` sums the character length of every key and value currently in that storage (`local` or `session`) and compares it against a conservative assumed limit of 5MB.

```
Without onQuotaWarning → no overhead, nothing is calculated
With onQuotaWarning     → recalculates total usage on every .set() call
                          (negligible cost for typical apps with a
                          reasonable number of keys)
```

---

## 🔄 Schema Migrations

When your schema changes between versions, migrations ensure users don't lose their data.

```typescript
// Version 1 — what users had stored:
// localStorage['app:theme'] = '"dark"'
// localStorage['app:fontSize'] = '16'

// Version 2 — your new schema:
const appStorage = createStorage({
    theme: 'dark' as 'dark' | 'light',
    preferences: {          // ← new nested object
        fontSize: 16,
        language: 'es'
    }
}, {
    prefix: 'app',
    version: 2,             // ← current schema version
    migrations: {
        1: (oldData) => ({  // ← transforms v1 data to v2
            theme: oldData.theme,
            preferences: {
                fontSize: oldData.fontSize,  // moves fontSize inside preferences
                language: 'es'              // adds new field with default
            }
        })
    }
});

// Old data is automatically migrated on first load
console.log(appStorage.preferences()); // { fontSize: 16, language: 'es' }
```

### Chained migrations (v1 → v2 → v3)

```typescript
createStorage(schema, {
    prefix: 'app',
    version: 3,
    migrations: {
        1: (data) => ({         // v1 → v2
            theme: data.theme,
            preferences: {
                fontSize: data.fontSize,
                language: 'es'
            }
        }),
        2: (data) => ({         // v2 → v3
            ...data,
            preferences: {
                ...data.preferences,
                sidebarOpen: true  // adds new field in v3
            }
        })
    }
});
```

### How migrations work

```
1. On createStorage(), reads the saved version from localStorage
   key: 'prefix__version__'

2. If no version saved → new install, saves current version and continues

3. If saved version < current version:
   → reads all current data from localStorage
   → applies each migration in order (v1→v2, v2→v3, etc.)
   → saves migrated data back to localStorage
   → updates the version key

4. If saved version === current version → nothing to do
```

---

## 🔍 Schema type registry

`createStorage()` automatically registers the primitive type of each schema key in a special localStorage entry:

```typescript
createStorage({
    theme: 'dark' as 'dark' | 'light',
    sidebarOpen: true,
    fontSize: 16
}, { prefix: 'app' });

// Automatically stored in localStorage as:
// localStorage['__typed-storage-schema__'] = {
//     "app": { "theme": "string", "sidebarOpen": "boolean", "fontSize": "number" }
// }
```

You don't need to do anything for this — it happens automatically from the schema you already define. This registry exists so tools like [typed-storage-devtools](https://github.com/JeanHaro/typed-storage-devtools) can validate edits before they're saved, preventing things like setting `sidebarOpen` to the string `"trues"` when it should be a boolean.

> Note: this captures the primitive type (`string`, `number`, `boolean`, `object`) via `typeof`, not the specific literal union (`'dark' | 'light'`) — that information doesn't exist in compiled JavaScript, only at TypeScript compile time.

## 🗄️ Heavy data with IndexedDB

For large datasets that exceed `localStorage`'s ~5MB limit (file lists, extensive history, large collections), use `createHeavyStorage` — a separate async API backed by IndexedDB.

```typescript
import { createHeavyStorage } from 'typed-storage';

const heavyStorage = createHeavyStorage({
    documents: [] as Document[],
    userPhotos: [] as Photo[]
}, {
    dbName: 'myapp-storage',
    ttl: 86400000  // optional — same TTL support as the sync API
});

// All operations are async — IndexedDB is asynchronous by nature
await heavyStorage.documents.set([...manyDocuments]);
const docs = await heavyStorage.documents.get();
await heavyStorage.documents.remove();

heavyStorage.documents.onChange((newValue) => {
    console.log('documents changed:', newValue);
});

await heavyStorage.clear();
```

### Why a separate API?

`createStorage()` uses a synchronous Signal-like API by design — that's the core value of typed-storage. IndexedDB is asynchronous by nature, so mixing it into the same API would break that synchronous contract.

```
createStorage()       → sync, Signal-like, for UI preferences and small state
createHeavyStorage()  → async, Promise-based, for large datasets
```

If you only need small values (theme, language, settings), stick with `createStorage()`. Use `createHeavyStorage()` only when you specifically need to store data beyond localStorage's size limits.

### `HeavySignal<T>` API

| Member | Description |
|--------|-------------|
| `signal.get()` | Returns a Promise with the current value |
| `signal.set(value)` | Stores the value, returns a Promise |
| `signal.remove()` | Deletes the value, returns a Promise |
| `signal.onChange(cb)` | Subscribes to value changes (called synchronously after set/remove) |

---

## ⚙️ Options

```typescript
const appStorage = createStorage(schema, options);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | — | Prepends `prefix:` to every key in localStorage |
| `storage` | `'local' \| 'session'` | `'local'` | Use `sessionStorage` instead of `localStorage` |
| `ttl` | `number` | — | Time to live in milliseconds — key expires after this time. Must be >= 0 |
| `sync` | `boolean` | `false` | Sync values across browser tabs via `StorageEvent` |
| `version` | `number` | — | Current schema version — requires `migrations` if set |
| `migrations` | `Record<number, (data) => data>` | — | Migration functions per version — required if `version` is set |
| `compress` | `boolean` | `false` | Compresses data with LZ-string before storing |
| `encrypt` | `boolean` | `false` | Obfuscates data with XOR + Base64 — requires `secret`, see security note below |
| `secret` | `string` | — | Required when `encrypt: true` — the obfuscation key |
| `routeOverrides` | `Record<string, Record<string, any> & { __once?: boolean }>` | — | Maps routes to key values, applied via `setRoute()`. Use `null` to remove a key for a route, `__once: true` to apply an override only on the first visit |
| `validate` | `Record<string, { safeParse(value): { success, error? } }>` | — | Optional runtime validation per key, compatible with Zod schemas |
| `onQuotaWarning` | `(percentUsed: number) => void` | — | Called after `.set()` if estimated storage usage exceeds `quotaThreshold` |
| `quotaThreshold` | `number` | `80` | Percentage (0-100) at which `onQuotaWarning` fires |

Invalid combinations (`encrypt` without `secret`, `version` without `migrations`, negative `ttl`) throw a descriptive error immediately when `createStorage()` is called.

---

## 📦 Compression

For large or repetitive data (lists, history, complex objects), enable compression to reduce the space used in `localStorage`:

```typescript
const appStorage = createStorage({
    cart: { items: [] }
}, {
    prefix: 'shop',
    compress: true
});

appStorage.cart.set({ items: [...manyProducts] });
// Data is compressed with LZ-string before saving
// and decompressed automatically when read
```

### When to use it

```
✅ Useful for:
   - Large lists (shopping carts, history)
   - Repetitive JSON structures
   - Data approaching localStorage's ~5MB limit

❌ Not needed for:
   - Small values like theme, language, fontSize
   - The compression overhead isn't worth it for tiny data
```

Compression only runs when `compress: true` is explicitly set — there's zero overhead for the default use case.

---

## 🔔 onChange

Subscribe to changes on any key:

```typescript
appStorage.theme.onChange((newValue) => {
  console.log('theme changed to:', newValue);
  document.body.setAttribute('data-theme', newValue);
});

appStorage.theme.set('light'); // → 'theme changed to: light'
appStorage.theme.reset();      // → 'theme changed to: dark'
appStorage.theme.remove();     // → 'theme changed to: dark' (initialValue)
```

---

## 🔒 Encryption (XOR obfuscation)

`typed-storage` can obfuscate values using XOR + Base64 before storing them. This is **not real cryptography** — read this section carefully before using it.

```typescript
const secureStorage = createStorage({
    token: ''
}, {
    encrypt: true,
    secret: 'your-secret-key',  // required when encrypt is true
    ttl: 3600000                // recommended — expire alongside your real token
});

secureStorage.token.set('eyJhbGciOiJIUzI1NiJ9.xxx.yyy');
// Stored in localStorage as obfuscated text, not the readable JWT

const token = secureStorage.token();
// Automatically decrypted — returns the real JWT
```

### ⚠️ What this actually protects against

```
✅ Hides the value from casual inspection in DevTools/Application/Storage
✅ Discourages non-technical users from reading or copying the value
✅ Combined with ttl, expires alongside your backend token

❌ Does NOT protect against a technical attacker
❌ Does NOT protect against debugger breakpoints — the secret and
   decrypted value are visible in memory while the app runs
❌ Is NOT equivalent to real cryptography (AES, etc.)
```

### Why this limitation exists — and why no frontend library can fix it

The `secret` you pass lives in your JavaScript code, which runs in the user's browser. No matter the algorithm used (XOR, AES, anything), **the key must be present in the frontend to decrypt the value**, which means it's always inspectable:

```
1. The secret travels safely over HTTPS — that's not the problem
2. Once it reaches the browser, it must be used by your JS to decrypt
3. Anyone with DevTools open can set a breakpoint where decryption
   happens and read the secret and the decrypted value directly
4. This is true even with industry-standard encryption (Web Crypto AES) —
   the algorithm's strength doesn't matter if the key is exposed
```

This is a fundamental limitation of any frontend-only encryption — not a flaw specific to typed-storage's XOR implementation.

### For real security with auth tokens

```typescript
// In your backend (Express / NestJS):
res.cookie('authToken', token, {
    httpOnly: true,   // JavaScript cannot read this — ever
    secure: true,     // HTTPS only
    sameSite: 'strict'
});
```

httpOnly cookies are the only approach where the token never becomes accessible to JavaScript running in the browser — because the browser itself enforces the restriction, not your code.

### When `encrypt` is still worth using

```
✅ You understand it's obfuscation, not security
✅ You want to deter casual inspection, not block determined attackers
✅ You're combining it with ttl so values expire predictably
✅ The data isn't critical enough to justify httpOnly cookie infrastructure
   (e.g. you're prototyping, or it's a low-stakes internal tool)

❌ Don't rely on this alone for banking, healthcare, or any data where
   a breach has real consequences — use httpOnly cookies on the backend
```

---

## 🅰️ Usage with Angular

```bash
pnpm add @jeanharo98/typed-storage @jeanharo98/typed-storage-angular
```

See [@jeanharo98/typed-storage-angular](https://github.com/JeanHaro/typed-storage-angular) for full documentation.

```typescript
@Service()
export class StorageService {
    storage: AppStorage;

    constructor() {
        const ts = new TypedStorageService();
        this.storage = ts.initialize({
            theme: 'dark' as 'dark' | 'light',
            language: 'es' as 'es' | 'en',
        }, { prefix: 'app', sync: true }) as unknown as AppStorage;
    }
}
```

---

## ⚛️ Usage with React

```bash
pnpm add @jeanharo98/typed-storage @jeanharo98/typed-storage-react
```

See [@jeanharo98/typed-storage-react](https://github.com/JeanHaro/typed-storage-react) for full documentation.

```typescript
function App() {
    const storage = useStorage({
        theme: 'dark' as 'dark' | 'light',
        language: 'es' as 'es' | 'en',
    }, { prefix: 'app', sync: true });

    return <p>Theme: {storage.theme}</p>;
}
```

---

## 📋 API Reference

### `createStorage(schema, options?)`

Creates a storage object from a schema. Returns a `StorageResult<T>` with one `StorageSignal` per key, plus `clear()`, `destroy()`, `batch()`, and `setRoute()`.

### `computed(signals, compute)`

Combines one or more `StorageSignal`s into a derived reactive value. Returns a function that recomputes on every call.

### `StorageSignal<T>`

| Member | Description |
|--------|-------------|
| `signal()` | Returns the current value |
| `signal.set(value)` | Updates the value and persists to storage |
| `signal.reset()` | Resets to `initialValue` and persists (key still exists) |
| `signal.remove()` | Removes the key from storage and resets in memory |
| `signal.has()` | Returns `true` if the key exists in storage |
| `signal.onChange(cb)` | Subscribes to value changes |

### `StorageResult<T>`

| Member | Description |
|--------|-------------|
| `[key]` | One `StorageSignal` per schema key |
| `clear()` | Calls `reset()` on all keys in the schema (keys still exist) |
| `destroy()` | Calls `remove()` on all keys — completely removes them from storage |
| `batch(values)` | Updates multiple keys in a single call |
| `setRoute(route)` | Applies the `routeOverrides` entry matching `route`, if any |

---

## 🔗 Related packages

| Package | Description |
|---------|-------------|
| [@jeanharo98/typed-storage-angular](https://github.com/JeanHaro/typed-storage-angular) | Angular wrapper with native Signals |
| [@jeanharo98/typed-storage-react](https://github.com/JeanHaro/typed-storage-react) | React wrapper with useStorage() hook |
| [typed-storage-devtools](https://github.com/JeanHaro/typed-storage-devtools) | Chrome DevTools extension for real-time inspection |

---

## 📄 License

MIT