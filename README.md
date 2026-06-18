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

## ⚙️ Options

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
| `encrypt` | `boolean` | `false` | Shows a security warning — see note below |

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

## 🔒 A note on encryption

If you pass `encrypt: true`, typed-storage will display a warning explaining why encrypting values in `localStorage` is not a secure practice — the encryption key must live in the frontend and is accessible to anyone who inspects your code.

For sensitive data such as auth tokens or personal information, use **httpOnly cookies** set by your server:

```typescript
// In your backend (Express / NestJS):
res.cookie('authToken', token, {
  httpOnly: true,   // not accessible from JavaScript
  secure: true,     // HTTPS only
  sameSite: 'strict'
});
```

typed-storage is designed for:
- ✅ UI preferences (theme, language, font size)
- ✅ Navigation state (last visited, sidebar open)
- ✅ Non-sensitive user settings
- ❌ Auth tokens → use httpOnly cookies
- ❌ Passwords or financial data → never in localStorage

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