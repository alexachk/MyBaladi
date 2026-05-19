/**
 * react-native-appwrite realtime reads session cookies via window.localStorage.
 * RN has no localStorage — without this polyfill, subscribe() throws getItem of undefined.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERSIST_KEY = '@mybaladi/localStorage-polyfill';
const memory: Record<string, string> = {};

function createStorage(): Storage {
  return {
    get length() {
      return Object.keys(memory).length;
    },
    key(index: number) {
      return Object.keys(memory)[index] ?? null;
    },
    getItem(key: string) {
      return memory[key] ?? null;
    },
    setItem(key: string, value: string) {
      memory[key] = String(value);
      AsyncStorage.setItem(PERSIST_KEY, JSON.stringify(memory)).catch(() => undefined);
    },
    removeItem(key: string) {
      delete memory[key];
      AsyncStorage.setItem(PERSIST_KEY, JSON.stringify(memory)).catch(() => undefined);
    },
    clear() {
      for (const k of Object.keys(memory)) delete memory[k];
      AsyncStorage.removeItem(PERSIST_KEY).catch(() => undefined);
    },
  };
}

const storage = createStorage();

function install() {
  const g = globalThis as typeof globalThis & {
    window?: { localStorage?: Storage };
    localStorage?: Storage;
  };

  // Ensure a `window` object exists and points to globalThis.
  if (!g.window) {
    try {
      Object.defineProperty(g, 'window', {
        value: g,
        writable: true,
        configurable: true,
      });
    } catch {
      (g as { window?: unknown }).window = g;
    }
  }

  // Force a working `localStorage` on both globalThis and window references.
  try {
    g.localStorage = storage;
  } catch {
    // ignore
  }
  try {
    if (g.window) g.window.localStorage = storage;
  } catch {
    // ignore
  }
}

/** Call once on app boot so realtime can read persisted Appwrite session cookies. */
export async function hydrateLocalStoragePolyfill(): Promise<void> {
  install();
  try {
    const raw = await AsyncStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, string>;
    Object.assign(memory, parsed);
  } catch {
    // ignore corrupt cache
  }
}

// Install synchronously at module evaluation, before any Appwrite Client is constructed.
install();
