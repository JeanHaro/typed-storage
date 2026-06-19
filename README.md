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

// Clear all keys in the schema
appStorage.clear();
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



```typescript
const appStorage = createStorage(schema, options);
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `prefix` | `string` | — | Prepends `prefix:` to every key in localStorage |
| `storage` | `'local' \| 'session'` | `'local'` | Use `sessionStorage` instead of `localStorage` |
| `ttl` | `number` | — | Time to live in milliseconds — key expires after this time |
| `sync` | `boolean` | `false` | Sync values across browser tabs via `StorageEvent` |
| `version` | `number` | — | Current schema version — required for migrations |
| `migrations` | `Record<number, (data) => data>` | — | Migration functions per version |
| `compress` | `boolean` | `false` | Compresses data with LZ-string before storing |
| `encrypt` | `boolean` | `false` | Obfuscates data with XOR + Base64 — see security note below |
| `secret` | `string` | — | Required when `encrypt: true` — the obfuscation key |

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

Creates a storage object from a schema. Returns a `StorageResult<T>` with one `StorageSignal` per key, plus a `clear()` method.

### `StorageSignal<T>`

| Member | Description |
|--------|-------------|
| `signal()` | Returns the current value |
| `signal.set(value)` | Updates the value and persists to storage |
| `signal.reset()` | Resets to `initialValue` and persists |
| `signal.remove()` | Removes the key from storage and resets in memory |
| `signal.has()` | Returns `true` if the key exists in storage |
| `signal.onChange(cb)` | Subscribes to value changes |

### `StorageResult<T>`

| Member | Description |
|--------|-------------|
| `[key]` | One `StorageSignal` per schema key |
| `clear()` | Calls `reset()` on all keys in the schema |

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