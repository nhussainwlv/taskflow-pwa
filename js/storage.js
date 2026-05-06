/**
 * Student Name : Naeem Hussain
 * ID : 2365963
 * Module Name : Project and Professionalism
 * Note: Comments in this file are kept brief and readable.
 */

/**
 * ============================================================================
 * STORAGE.JS - Storage Adapter
 * ============================================================================
 * Abstracted storage layer using adapter pattern.
 * Currently uses localStorage, easily swappable for IndexedDB or API.
 * @module storage
 */

/**
 * @typedef {Object} StorageAdapter
 * @property {function(string): Promise<any>} get - Get item
 * @property {function(string, any): Promise<void>} set - Set item
 * @property {function(string): Promise<void>} remove - Remove item
 * @property {function(): Promise<void>} clear - Clear all items
 * @property {function(): Promise<string[]>} keys - Get all keys
 */

/**
 * Storage key prefix to avoid conflicts
 * @type {string}
 */
const STORAGE_PREFIX = 'taskflow_';

/**
 * LocalStorage adapter implementation
 * @type {StorageAdapter}
 */
const localStorageAdapter = {
    /**
     * Gets an item from localStorage
     * @param {string} key - Storage key
     * @returns {Promise<any>} Stored value or null
     */
    async get(key) {
        try {
            const item = localStorage.getItem(STORAGE_PREFIX + key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error(`[Storage] Failed to get "${key}":`, error);
            return null;
        }
    },

    /**
     * Sets an item in localStorage
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * @returns {Promise<void>}
     */
    async set(key, value) {
        try {
            localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
        } catch (error) {
            console.error(`[Storage] Failed to set "${key}":`, error);
            // Handle quota exceeded
            if (error.name === 'QuotaExceededError') {
                console.warn('[Storage] Storage quota exceeded, attempting cleanup...');
                await this.cleanup();
                // Retry once
                try {
                    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
                } catch (retryError) {
                    console.error('[Storage] Retry failed:', retryError);
                }
            }
        }
    },

    /**
     * Removes an item from localStorage
     * @param {string} key - Storage key
     * @returns {Promise<void>}
     */
    async remove(key) {
        try {
            localStorage.removeItem(STORAGE_PREFIX + key);
        } catch (error) {
            console.error(`[Storage] Failed to remove "${key}":`, error);
        }
    },

    /**
     * Clears all TaskFlow items from localStorage
     * @returns {Promise<void>}
     */
    async clear() {
        try {
            const keys = await this.keys();
            keys.forEach(key => {
                localStorage.removeItem(STORAGE_PREFIX + key);
            });
        } catch (error) {
            console.error('[Storage] Failed to clear:', error);
        }
    },

    /**
     * Gets all TaskFlow storage keys
     * @returns {Promise<string[]>} Array of keys (without prefix)
     */
    async keys() {
        const allKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(STORAGE_PREFIX)) {
                allKeys.push(key.replace(STORAGE_PREFIX, ''));
            }
        }
        return allKeys;
    },

    /**
     * Cleans up old/unnecessary data to free space
     * @returns {Promise<void>}
     */
    async cleanup() {
        // Remove old cache entries, logs, etc.
        const keysToRemove = ['logs', 'cache', 'temp'];
        for (const key of keysToRemove) {
            await this.remove(key);
        }
    }
};

/**
 * IndexedDB adapter implementation (for future use)
 * @type {StorageAdapter}
 */
const indexedDBAdapter = {
    dbName: 'TaskFlowDB',
    dbVersion: 1,
    storeName: 'data',
    db: null,

    /**
     * Opens/creates the IndexedDB database
     * @returns {Promise<IDBDatabase>}
     */
    async openDB() {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
        });
    },

    async get(key) {
        try {
            const db = await this.openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.get(key);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result ?? null);
            });
        } catch (error) {
            console.error(`[Storage/IDB] Failed to get "${key}":`, error);
            return null;
        }
    },

    async set(key, value) {
        try {
            const db = await this.openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.put(value, key);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        } catch (error) {
            console.error(`[Storage/IDB] Failed to set "${key}":`, error);
        }
    },

    async remove(key) {
        try {
            const db = await this.openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.delete(key);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        } catch (error) {
            console.error(`[Storage/IDB] Failed to remove "${key}":`, error);
        }
    },

    async clear() {
        try {
            const db = await this.openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = store.clear();

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve();
            });
        } catch (error) {
            console.error('[Storage/IDB] Failed to clear:', error);
        }
    },

    async keys() {
        try {
            const db = await this.openDB();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction(this.storeName, 'readonly');
                const store = transaction.objectStore(this.storeName);
                const request = store.getAllKeys();

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);
            });
        } catch (error) {
            console.error('[Storage/IDB] Failed to get keys:', error);
            return [];
        }
    }
};

/**
 * Memory adapter for testing
 * @type {StorageAdapter}
 */
const memoryAdapter = {
    data: new Map(),

    async get(key) {
        return this.data.get(key) ?? null;
    },

    async set(key, value) {
        this.data.set(key, value);
    },

    async remove(key) {
        this.data.delete(key);
    },

    async clear() {
        this.data.clear();
    },

    async keys() {
        return Array.from(this.data.keys());
    }
};

/**
 * Current storage adapter
 * @type {StorageAdapter}
 */
let currentAdapter = localStorageAdapter;

/**
 * Storage facade with adapter pattern
 */
export const storage = {
    /**
     * Gets an item from storage
     * @param {string} key - Storage key
     * @returns {Promise<any>}
     */
    get: (key) => currentAdapter.get(key),

    /**
     * Sets an item in storage
     * @param {string} key - Storage key
     * @param {any} value - Value to store
     * @returns {Promise<void>}
     */
    set: (key, value) => currentAdapter.set(key, value),

    /**
     * Removes an item from storage
     * @param {string} key - Storage key
     * @returns {Promise<void>}
     */
    remove: (key) => currentAdapter.remove(key),

    /**
     * Clears all items from storage
     * @returns {Promise<void>}
     */
    clear: () => currentAdapter.clear(),

    /**
     * Gets all storage keys
     * @returns {Promise<string[]>}
     */
    keys: () => currentAdapter.keys(),

    /**
     * Switches to a different storage adapter
     * @param {'localStorage'|'indexedDB'|'memory'} adapterName
     */
    useAdapter(adapterName) {
        switch (adapterName) {
            case 'indexedDB':
                currentAdapter = indexedDBAdapter;
                break;
            case 'memory':
                currentAdapter = memoryAdapter;
                break;
            case 'localStorage':
            default:
                currentAdapter = localStorageAdapter;
        }
        console.log(`[Storage] Switched to ${adapterName} adapter`);
    },

    /**
     * Gets storage usage information
     * @returns {Promise<Object>} Usage stats
     */
    async getUsage() {
        if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
            const estimate = await navigator.storage.estimate();
            return {
                used: estimate.usage || 0,
                quota: estimate.quota || 0,
                percentUsed: estimate.quota 
                    ? Math.round((estimate.usage / estimate.quota) * 100) 
                    : 0
            };
        }

        // Fallback for localStorage
        let totalSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                totalSize += (localStorage.getItem(key)?.length || 0) * 2; // UTF-16
            }
        }

        return {
            used: totalSize,
            quota: 5 * 1024 * 1024, // Approximate 5MB limit
            percentUsed: Math.round((totalSize / (5 * 1024 * 1024)) * 100)
        };
    },

    /**
     * Exports all data as JSON
     * @returns {Promise<string>} JSON string
     */
    async exportData() {
        const keys = await this.keys();
        const data = {};

        for (const key of keys) {
            data[key] = await this.get(key);
        }

        return JSON.stringify(data, null, 2);
    },

    /**
     * Imports data from JSON
     * @param {string} jsonString - JSON data string
     * @returns {Promise<boolean>} Success status
     */
    async importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            for (const [key, value] of Object.entries(data)) {
                await this.set(key, value);
            }

            return true;
        } catch (error) {
            console.error('[Storage] Import failed:', error);
            return false;
        }
    }
};

/**
 * Saved Views storage helper
 */
export const savedViews = {
    STORAGE_KEY: 'savedViews',

    /**
     * Gets all saved views
     * @returns {Promise<Array>}
     */
    async getAll() {
        return (await storage.get(this.STORAGE_KEY)) || [];
    },

    /**
     * Saves a view configuration
     * @param {Object} view - View to save
     * @returns {Promise<Object>}
     */
    async save(view) {
        const views = await this.getAll();
        const newView = {
            id: Date.now().toString(),
            createdAt: new Date().toISOString(),
            ...view
        };
        views.push(newView);
        await storage.set(this.STORAGE_KEY, views);
        return newView;
    },

    /**
     * Deletes a saved view
     * @param {string} viewId - View ID
     * @returns {Promise<boolean>}
     */
    async delete(viewId) {
        const views = await this.getAll();
        const filtered = views.filter(v => v.id !== viewId);
        await storage.set(this.STORAGE_KEY, filtered);
        return filtered.length < views.length;
    }
};

/**
 * Recent searches storage helper
 */
export const recentSearches = {
    STORAGE_KEY: 'recentSearches',
    MAX_ITEMS: 10,

    /**
     * Gets recent searches
     * @returns {Promise<string[]>}
     */
    async getAll() {
        return (await storage.get(this.STORAGE_KEY)) || [];
    },

    /**
     * Adds a search query
     * @param {string} query - Search query
     * @returns {Promise<void>}
     */
    async add(query) {
        if (!query?.trim()) return;

        let searches = await this.getAll();
        searches = searches.filter(s => s !== query);
        searches.unshift(query);
        searches = searches.slice(0, this.MAX_ITEMS);

        await storage.set(this.STORAGE_KEY, searches);
    },

    /**
     * Clears all recent searches
     * @returns {Promise<void>}
     */
    async clear() {
        await storage.remove(this.STORAGE_KEY);
    }
};

// Auto-detect best adapter on load
if (typeof window !== 'undefined') {
    // Check if localStorage is available
    try {
        localStorage.setItem('__test__', '__test__');
        localStorage.removeItem('__test__');
    } catch (e) {
        // localStorage not available, use memory
        console.warn('[Storage] localStorage not available, using memory adapter');
        currentAdapter = memoryAdapter;
    }
}
