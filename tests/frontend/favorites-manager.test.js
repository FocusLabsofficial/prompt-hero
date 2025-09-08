// Frontend Tests for Favorites Manager
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head></head>
<body>
    <div id="favoritesCount" class="favorites-count">0</div>
    <div class="favorite-btn" data-prompt-id="1">🤍</div>
    <div class="favorite-btn" data-prompt-id="2">🤍</div>
</body>
</html>
`, {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock fetch
global.fetch = vi.fn();

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
global.localStorage = localStorageMock;

// Mock console methods
global.console = {
    ...console,
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
};

describe('FavoritesManager', () => {
    let FavoritesManager;

    beforeEach(async () => {
        // Clear all mocks
        vi.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);
        
        // Mock successful fetch for favorites API
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({ favorites: [] })
        });

        // Dynamically import FavoritesManager after setting up mocks
        const module = await import('../../docs/js/favorites-manager.js');
        FavoritesManager = module.default;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with empty favorites', () => {
            const manager = new FavoritesManager();
            expect(manager.favorites).toEqual([]);
        });

        it('should load favorites from localStorage', () => {
            localStorageMock.getItem.mockReturnValue(JSON.stringify(['1', '2', '3']));
            const manager = new FavoritesManager();
            expect(manager.favorites).toEqual(['1', '2', '3']);
        });

        it('should handle invalid localStorage data gracefully', () => {
            localStorageMock.getItem.mockReturnValue('invalid json');
            const manager = new FavoritesManager();
            expect(manager.favorites).toEqual([]);
            expect(console.error).toHaveBeenCalled();
        });

        it('should load collections from localStorage', () => {
            const collections = [
                { id: '1', name: 'My Collection', prompts: ['1', '2'] }
            ];
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'promptHero_favorites') return '[]';
                if (key === 'promptHero_collections') return JSON.stringify(collections);
                return null;
            });
            
            const manager = new FavoritesManager();
            expect(manager.collections).toEqual(collections);
        });
    });

    describe('Favorites Management', () => {
        let manager;

        beforeEach(() => {
            manager = new FavoritesManager();
        });

        it('should add prompt to favorites', () => {
            manager.addToFavorites('1');
            
            expect(manager.favorites).toContain('1');
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'promptHero_favorites',
                JSON.stringify(['1'])
            );
        });

        it('should remove prompt from favorites', () => {
            manager.favorites = ['1', '2'];
            manager.removeFromFavorites('1');
            
            expect(manager.favorites).not.toContain('1');
            expect(manager.favorites).toContain('2');
        });

        it('should not add duplicate favorites', () => {
            manager.favorites = ['1'];
            manager.addToFavorites('1');
            
            expect(manager.favorites).toEqual(['1']);
        });

        it('should check if prompt is favorited', () => {
            manager.favorites = ['1', '2'];
            
            expect(manager.isFavorited('1')).toBe(true);
            expect(manager.isFavorited('3')).toBe(false);
        });

        it('should get favorites count', () => {
            manager.favorites = ['1', '2', '3'];
            
            expect(manager.getFavoritesCount()).toBe(3);
        });

        it('should clear all favorites', () => {
            manager.favorites = ['1', '2', '3'];
            manager.clearFavorites();
            
            expect(manager.favorites).toEqual([]);
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'promptHero_favorites',
                JSON.stringify([])
            );
        });
    });

    describe('Collections Management', () => {
        let manager;

        beforeEach(() => {
            manager = new FavoritesManager();
        });

        it('should create a new collection', () => {
            const collection = manager.createCollection('My New Collection', 'A test collection');
            
            expect(collection.id).toBeDefined();
            expect(collection.name).toBe('My New Collection');
            expect(collection.description).toBe('A test collection');
            expect(collection.prompts).toEqual([]);
            expect(manager.collections).toContain(collection);
        });

        it('should add prompt to collection', () => {
            const collection = manager.createCollection('Test Collection');
            manager.addToCollection(collection.id, '1');
            
            expect(collection.prompts).toContain('1');
        });

        it('should remove prompt from collection', () => {
            const collection = manager.createCollection('Test Collection');
            collection.prompts = ['1', '2'];
            manager.removeFromCollection(collection.id, '1');
            
            expect(collection.prompts).not.toContain('1');
            expect(collection.prompts).toContain('2');
        });

        it('should delete collection', () => {
            const collection = manager.createCollection('Test Collection');
            const collectionId = collection.id;
            
            manager.deleteCollection(collectionId);
            
            expect(manager.collections.find(c => c.id === collectionId)).toBeUndefined();
        });

        it('should get collection by id', () => {
            const collection = manager.createCollection('Test Collection');
            const found = manager.getCollection(collection.id);
            
            expect(found).toEqual(collection);
        });

        it('should return undefined for non-existent collection', () => {
            const found = manager.getCollection('non-existent');
            expect(found).toBeUndefined();
        });

        it('should get all collections', () => {
            const collection1 = manager.createCollection('Collection 1');
            const collection2 = manager.createCollection('Collection 2');
            
            const allCollections = manager.getAllCollections();
            
            expect(allCollections).toHaveLength(2);
            expect(allCollections).toContain(collection1);
            expect(allCollections).toContain(collection2);
        });
    });

    describe('UI Updates', () => {
        let manager;

        beforeEach(() => {
            manager = new FavoritesManager();
        });

        it('should update favorites count display', () => {
            manager.favorites = ['1', '2', '3'];
            manager.updateFavoritesCount();
            
            const countElement = document.getElementById('favoritesCount');
            expect(countElement.textContent).toBe('3');
        });

        it('should update favorite button states', () => {
            manager.favorites = ['1'];
            manager.updateFavoriteButtons();
            
            const button1 = document.querySelector('[data-prompt-id="1"]');
            const button2 = document.querySelector('[data-prompt-id="2"]');
            
            expect(button1.classList.contains('favorited')).toBe(true);
            expect(button2.classList.contains('favorited')).toBe(false);
        });

        it('should handle missing UI elements gracefully', () => {
            // Remove the favorites count element
            const countElement = document.getElementById('favoritesCount');
            countElement.remove();
            
            // Should not throw error
            expect(() => manager.updateFavoritesCount()).not.toThrow();
        });
    });

    describe('Event Handling', () => {
        let manager;

        beforeEach(() => {
            manager = new FavoritesManager();
        });

        it('should handle favorite button clicks', () => {
            const button = document.querySelector('[data-prompt-id="1"]');
            const addSpy = vi.spyOn(manager, 'addToFavorites');
            const removeSpy = vi.spyOn(manager, 'removeFromFavorites');
            
            // Test adding to favorites
            manager.favorites = [];
            button.click();
            expect(addSpy).toHaveBeenCalledWith('1');
            
            // Test removing from favorites
            manager.favorites = ['1'];
            button.click();
            expect(removeSpy).toHaveBeenCalledWith('1');
        });

        it('should toggle favorite state correctly', () => {
            const button = document.querySelector('[data-prompt-id="1"]');
            
            // Initially not favorited
            expect(manager.isFavorited('1')).toBe(false);
            
            // Click to add
            button.click();
            expect(manager.isFavorited('1')).toBe(true);
            
            // Click to remove
            button.click();
            expect(manager.isFavorited('1')).toBe(false);
        });
    });

    describe('Data Persistence', () => {
        let manager;

        beforeEach(() => {
            manager = new FavoritesManager();
        });

        it('should save favorites to localStorage', () => {
            manager.addToFavorites('1');
            manager.addToFavorites('2');
            
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'promptHero_favorites',
                JSON.stringify(['1', '2'])
            );
        });

        it('should save collections to localStorage', () => {
            const collection = manager.createCollection('Test Collection');
            
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'promptHero_collections',
                expect.stringContaining('Test Collection')
            );
        });

        it('should handle localStorage errors gracefully', () => {
            localStorageMock.setItem.mockImplementation(() => {
                throw new Error('Storage quota exceeded');
            });
            
            // Should not throw error
            expect(() => manager.addToFavorites('1')).not.toThrow();
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('Collection Validation', () => {
        let manager;

        beforeEach(() => {
            manager = new FavoritesManager();
        });

        it('should validate collection name', () => {
            expect(() => manager.createCollection('')).toThrow('Collection name is required');
            expect(() => manager.createCollection('   ')).toThrow('Collection name is required');
        });

        it('should prevent duplicate collection names', () => {
            manager.createCollection('Test Collection');
            
            expect(() => manager.createCollection('Test Collection')).toThrow(
                'A collection with this name already exists'
            );
        });

        it('should validate collection ID when adding prompts', () => {
            expect(() => manager.addToCollection('invalid-id', '1')).toThrow(
                'Collection not found'
            );
        });

        it('should validate collection ID when removing prompts', () => {
            expect(() => manager.removeFromCollection('invalid-id', '1')).toThrow(
                'Collection not found'
            );
        });
    });

    describe('Error Handling', () => {
        let manager;

        beforeEach(() => {
            manager = new FavoritesManager();
        });

        it('should handle invalid prompt IDs gracefully', () => {
            expect(() => manager.addToFavorites(null)).not.toThrow();
            expect(() => manager.addToFavorites(undefined)).not.toThrow();
            expect(() => manager.addToFavorites('')).not.toThrow();
        });

        it('should handle missing localStorage gracefully', () => {
            // Mock localStorage as undefined
            const originalLocalStorage = global.localStorage;
            delete global.localStorage;
            
            const newManager = new FavoritesManager();
            expect(newManager.favorites).toEqual([]);
            expect(newManager.collections).toEqual([]);
            
            // Restore localStorage
            global.localStorage = originalLocalStorage;
        });

        it('should handle corrupted localStorage data', () => {
            localStorageMock.getItem.mockReturnValue('{"invalid": json}');
            
            const newManager = new FavoritesManager();
            expect(newManager.favorites).toEqual([]);
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('Performance', () => {
        let manager;

        beforeEach(() => {
            manager = new FavoritesManager();
        });

        it('should handle large numbers of favorites efficiently', () => {
            const largeFavoritesList = Array.from({ length: 1000 }, (_, i) => i.toString());
            manager.favorites = largeFavoritesList;
            
            const startTime = performance.now();
            const isFavorited = manager.isFavorited('500');
            const endTime = performance.now();
            
            expect(isFavorited).toBe(true);
            expect(endTime - startTime).toBeLessThan(10); // Should be very fast
        });

        it('should handle large numbers of collections efficiently', () => {
            // Create many collections
            for (let i = 0; i < 100; i++) {
                manager.createCollection(`Collection ${i}`);
            }
            
            const startTime = performance.now();
            const allCollections = manager.getAllCollections();
            const endTime = performance.now();
            
            expect(allCollections).toHaveLength(100);
            expect(endTime - startTime).toBeLessThan(50); // Should be reasonably fast
        });
    });
});
