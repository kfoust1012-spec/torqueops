import * as SecureStore from "./native-secure-store";

import { platformOS } from "./platform-os";

const inMemoryWebStorage = new Map<string, string>();

function normalizeNativeStorageKey(key: string) {
  const normalized = key.trim().replaceAll(/[^0-9A-Za-z._-]+/g, "_").replaceAll(/_+/g, "_");

  return normalized.length ? normalized : "mobile_mechanic_storage";
}

function getStorageKey(key: string) {
  if (platformOS === "web") {
    return key;
  }

  return normalizeNativeStorageKey(key);
}

function getWebStorage() {
  if (typeof window !== "undefined" && typeof window.localStorage !== "undefined") {
    return window.localStorage;
  }

  return null;
}

export const clientStorage = {
  async getItem(key: string) {
    if (platformOS === "web") {
      const storage = getWebStorage();

      if (storage) {
        return storage.getItem(key);
      }

      return inMemoryWebStorage.get(key) ?? null;
    }

    return SecureStore.getItemAsync(getStorageKey(key));
  },
  async removeItem(key: string) {
    if (platformOS === "web") {
      const storage = getWebStorage();

      if (storage) {
        storage.removeItem(key);
        return;
      }

      inMemoryWebStorage.delete(key);
      return;
    }

    await SecureStore.deleteItemAsync(getStorageKey(key));
  },
  async setItem(key: string, value: string) {
    if (platformOS === "web") {
      const storage = getWebStorage();

      if (storage) {
        storage.setItem(key, value);
        return;
      }

      inMemoryWebStorage.set(key, value);
      return;
    }

    await SecureStore.setItemAsync(getStorageKey(key), value);
  }
};
