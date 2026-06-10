# typed-storage

Type-safe `localStorage` and `sessionStorage` with a signal-like API, TTL support, cross-tab sync, and automatic fallback to memory when storage is unavailable.

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

## ✨ Features

- **Type-safe** — TypeScript infers types from your schema automatically
- **Signal-like API** — read with `signal()`, write with `signal.set(value)`
- **TTL / expiration** — keys expire automatically after a defined time
- **Cross-tab sync** — changes in one tab reflect in others via `StorageEvent`
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

// Clear all keys in the schema
appStorage.clear();
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
| `encrypt` | `boolean` | `false` | Shows a security warning — see note below |

### Prefix

```typescript
const appStorage = createStorage(
  { theme: 'dark' },
  { prefix: 'myapp' }
);

appStorage.theme.set('light');
// Stored as: localStorage['myapp:theme'] = '"light"'
```

### TTL

```typescript
const appStorage = createStorage(
  { authToken: '' },
  { ttl: 3600000 } // expires in 1 hour
);
```

### Cross-tab sync

```typescript
const appStorage = createStorage(
  { theme: 'dark' },
  { sync: true }
);

// When another tab calls appStorage.theme.set('light'),
// this tab updates automatically
```

### sessionStorage

```typescript
const sessionData = createStorage(
  { step: 1 },
  { storage: 'session' }
);
```

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

typed-storage is framework-agnostic. For Angular, wrap it in a service with native Signals:

```typescript
import { Service, signal } from '@angular/core';
import { createStorage } from 'typed-storage';

@Service()
export class StorageService {
  private _storage = createStorage({
    theme: 'dark' as 'dark' | 'light',
    language: 'es' as 'es' | 'en',
    fontSize: 16,
  }, {
    prefix: 'app',
    sync: true,
  });

  // Native Angular Signals — reactive in any scenario including zoneless
  theme = signal(this._storage.theme());
  language = signal(this._storage.language());
  fontSize = signal(this._storage.fontSize());

  setTheme(value: 'dark' | 'light') {
    this._storage.theme.set(value);
    this.theme.set(value);
  }

  setLanguage(value: 'es' | 'en') {
    this._storage.language.set(value);
    this.language.set(value);
  }
}
```

```html
<p>Theme: {{ storageService.theme() }}</p>
<button (click)="storageService.setTheme('light')">Light</button>
<button (click)="storageService.setTheme('dark')">Dark</button>
```

---

## ⚛️ Usage with React

```typescript
import { useState, useEffect } from 'react';
import { createStorage } from 'typed-storage';

const appStorage = createStorage({
  theme: 'dark' as 'dark' | 'light',
});

export function useTheme() {
  const [theme, setThemeState] = useState(appStorage.theme());

  useEffect(() => {
    appStorage.theme.onChange(setThemeState);
  }, []);

  const setTheme = (value: 'dark' | 'light') => {
    appStorage.theme.set(value);
    setThemeState(value);
  };

  return { theme, setTheme };
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

## 📄 License

MIT