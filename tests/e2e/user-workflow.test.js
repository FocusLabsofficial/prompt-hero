// End-to-End Tests for User Workflows
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head></head>
<body>
    <div id="unifiedGrid"></div>
    <div id="searchResultsInfo" style="display: none;">
        <span id="resultsCount">0</span>
    </div>
    <div id="notificationContainer"></div>
    <div id="favoritesCount" class="favorites-count">0</div>
    
    <!-- Search and Filter Elements -->
    <div class="search-container">
        <input type="text" id="searchInput" placeholder="Search prompts...">
        <button id="searchBtn">Search</button>
    </div>
    
    <div class="search-filters">
        <button class="filter-chip active" data-category="all">All Prompts</button>
        <button class="filter-chip" data-category="development">Development</button>
        <button class="filter-chip" data-category="creative">Creative</button>
        <button class="filter-chip" data-featured="true">Featured</button>
        <button class="filter-chip" data-difficulty="beginner">Beginner</button>
    </div>
    
    <!-- Modal Elements -->
    <div id="ratingModal" class="rating-modal" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Rate this Prompt</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="rating-widget">
                    <div class="stars">
                        <span class="rating-star" data-rating="1">★</span>
                        <span class="rating-star" data-rating="2">★</span>
                        <span class="rating-star" data-rating="3">★</span>
                        <span class="rating-star" data-rating="4">★</span>
                        <span class="rating-star" data-rating="5">★</span>
                    </div>
                </div>
                <textarea placeholder="Write a review (optional)"></textarea>
            </div>
            <div class="modal-footer">
                <button class="submit-rating-btn">Submit Rating</button>
            </div>
        </div>
    </div>
    
    <div id="collectionModal" class="collection-modal" style="display: none;">
        <div class="modal-content">
            <div class="modal-header">
                <h3>Add to Collection</h3>
                <button class="modal-close">&times;</button>
            </div>
            <div class="modal-body">
                <div class="collection-list"></div>
                <div class="create-collection-section">
                    <input type="text" placeholder="Collection name">
                    <button class="create-collection-btn">Create Collection</button>
                </div>
            </div>
        </div>
    </div>
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

describe('User Workflow E2E Tests', () => {
    let PromptManager, FavoritesManager, ErrorHandler;

    beforeEach(async () => {
        // Clear all mocks
        vi.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);
        
        // Reset DOM
        document.getElementById('unifiedGrid').innerHTML = '';
        document.getElementById('notificationContainer').innerHTML = '';
        document.getElementById('searchInput').value = '';
        
        // Mock successful fetch for prompts.json
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                prompts: [
                    {
                        id: '1',
                        title: 'AI Code Review Assistant',
                        content: 'Review this code for bugs, performance issues, and best practices...',
                        description: 'Get comprehensive code reviews with AI assistance',
                        category: 'development',
                        author: 'testuser',
                        average_rating: 4.5,
                        total_ratings: 10,
                        is_featured: true,
                        difficulty_level: 'intermediate',
                        tags: ['ai', 'coding', 'review']
                    },
                    {
                        id: '2',
                        title: 'Creative Writing Prompt',
                        content: 'Write a creative story about...',
                        description: 'Generate creative writing ideas',
                        category: 'creative',
                        author: 'testuser2',
                        average_rating: 3.8,
                        total_ratings: 5,
                        is_featured: false,
                        difficulty_level: 'beginner',
                        tags: ['writing', 'creative']
                    }
                ]
            })
        });

        // Dynamically import modules after setting up mocks
        const promptModule = await import('../../docs/js/prompt-manager.js');
        const favoritesModule = await import('../../docs/js/favorites-manager.js');
        const errorModule = await import('../../docs/js/error-handler.js');
        
        PromptManager = promptModule.default;
        FavoritesManager = favoritesModule.default;
        ErrorHandler = errorModule.default;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Complete User Journey: Discover and Rate Prompts', () => {
        it('should allow user to browse, search, and rate prompts', async () => {
            // Initialize managers
            const promptManager = new PromptManager();
            const favoritesManager = new FavoritesManager();
            const errorHandler = new ErrorHandler();

            // Step 1: Load and display prompts
            await promptManager.loadPrompts();
            promptManager.renderPrompts(promptManager.prompts);

            let grid = document.getElementById('unifiedGrid');
            let cards = grid.querySelectorAll('.prompt-card');
            expect(cards).toHaveLength(2);

            // Step 2: Search for specific prompts
            const searchInput = document.getElementById('searchInput');
            searchInput.value = 'code';
            searchInput.dispatchEvent(new Event('input'));

            // Simulate search functionality
            const filteredPrompts = promptManager.filterPrompts({ query: 'code' });
            promptManager.renderPrompts(filteredPrompts);

            grid = document.getElementById('unifiedGrid');
            cards = grid.querySelectorAll('.prompt-card');
            expect(cards).toHaveLength(1);
            expect(cards[0].querySelector('h3').textContent).toBe('AI Code Review Assistant');

            // Step 3: Filter by category
            const devFilter = document.querySelector('[data-category="development"]');
            devFilter.click();

            const devPrompts = promptManager.filterPrompts({ category: 'development' });
            promptManager.renderPrompts(devPrompts);

            grid = document.getElementById('unifiedGrid');
            cards = grid.querySelectorAll('.prompt-card');
            expect(cards).toHaveLength(1);

            // Step 4: Add prompt to favorites
            const favoriteBtn = cards[0].querySelector('.favorite-btn');
            favoriteBtn.click();

            expect(favoritesManager.isFavorited('1')).toBe(true);
            expect(localStorageMock.setItem).toHaveBeenCalledWith(
                'promptHero_favorites',
                JSON.stringify(['1'])
            );

            // Step 5: Rate the prompt
            const rateBtn = cards[0].querySelector('.rate-btn');
            rateBtn.click();

            const ratingModal = document.getElementById('ratingModal');
            expect(ratingModal.style.display).toBe('block');

            // Select 5-star rating
            const stars = ratingModal.querySelectorAll('.rating-star');
            stars[4].click(); // 5th star

            // Submit rating
            const submitBtn = ratingModal.querySelector('.submit-rating-btn');
            submitBtn.click();

            // Modal should close
            expect(ratingModal.style.display).toBe('none');

            // Step 6: Add to collection
            const collectionBtn = cards[0].querySelector('.add-to-collection-btn');
            collectionBtn.click();

            const collectionModal = document.getElementById('collectionModal');
            expect(collectionModal.style.display).toBe('block');

            // Create new collection
            const collectionNameInput = collectionModal.querySelector('input[type="text"]');
            collectionNameInput.value = 'My Dev Prompts';
            collectionNameInput.dispatchEvent(new Event('input'));

            const createBtn = collectionModal.querySelector('.create-collection-btn');
            createBtn.click();

            // Collection should be created and prompt added
            const collections = favoritesManager.getAllCollections();
            expect(collections).toHaveLength(1);
            expect(collections[0].name).toBe('My Dev Prompts');
            expect(collections[0].prompts).toContain('1');

            // Modal should close
            expect(collectionModal.style.display).toBe('none');
        });
    });

    describe('User Journey: Create and Manage Collections', () => {
        it('should allow user to create, manage, and organize collections', async () => {
            const favoritesManager = new FavoritesManager();

            // Step 1: Create multiple collections
            const collection1 = favoritesManager.createCollection('Development Prompts', 'AI prompts for developers');
            const collection2 = favoritesManager.createCollection('Creative Writing', 'Prompts for creative writing');

            expect(favoritesManager.getAllCollections()).toHaveLength(2);

            // Step 2: Add prompts to collections
            favoritesManager.addToCollection(collection1.id, '1');
            favoritesManager.addToCollection(collection1.id, '2');
            favoritesManager.addToCollection(collection2.id, '2');

            expect(collection1.prompts).toEqual(['1', '2']);
            expect(collection2.prompts).toEqual(['2']);

            // Step 3: Remove prompt from collection
            favoritesManager.removeFromCollection(collection1.id, '1');
            expect(collection1.prompts).toEqual(['2']);

            // Step 4: Delete collection
            favoritesManager.deleteCollection(collection2.id);
            expect(favoritesManager.getAllCollections()).toHaveLength(1);
            expect(favoritesManager.getCollection(collection2.id)).toBeUndefined();
        });
    });

    describe('User Journey: Advanced Search and Filtering', () => {
        it('should allow user to use advanced search and filtering options', async () => {
            const promptManager = new PromptManager();
            await promptManager.loadPrompts();

            // Step 1: Filter by featured prompts
            const featuredFilter = document.querySelector('[data-featured="true"]');
            featuredFilter.click();

            let filteredPrompts = promptManager.filterPrompts({ featured: true });
            expect(filteredPrompts).toHaveLength(1);
            expect(filteredPrompts[0].is_featured).toBe(true);

            // Step 2: Filter by difficulty
            const beginnerFilter = document.querySelector('[data-difficulty="beginner"]');
            beginnerFilter.click();

            filteredPrompts = promptManager.filterPrompts({ difficulty: 'beginner' });
            expect(filteredPrompts).toHaveLength(1);
            expect(filteredPrompts[0].difficulty_level).toBe('beginner');

            // Step 3: Combine multiple filters
            filteredPrompts = promptManager.filterPrompts({
                category: 'development',
                featured: true,
                difficulty: 'intermediate'
            });
            expect(filteredPrompts).toHaveLength(1);

            // Step 4: Sort by rating
            filteredPrompts = promptManager.filterPrompts({ sort: 'rating' });
            expect(filteredPrompts[0].average_rating).toBe(4.5);
            expect(filteredPrompts[1].average_rating).toBe(3.8);

            // Step 5: Search with multiple terms
            filteredPrompts = promptManager.filterPrompts({ query: 'ai coding' });
            expect(filteredPrompts).toHaveLength(1);
            expect(filteredPrompts[0].title).toContain('AI');
        });
    });

    describe('User Journey: Error Handling and Recovery', () => {
        it('should handle errors gracefully and provide user feedback', async () => {
            const errorHandler = new ErrorHandler();
            const promptManager = new PromptManager();

            // Step 1: Handle network error
            global.fetch.mockRejectedValue(new Error('Network error'));
            
            const prompts = await promptManager.loadPrompts();
            expect(prompts).toBeDefined(); // Should fallback to mock data

            // Step 2: Show error notification
            errorHandler.showError('Failed to load prompts');
            
            const container = document.getElementById('notificationContainer');
            const errorNotification = container.querySelector('.notification.error');
            expect(errorNotification).toBeTruthy();
            expect(errorNotification.textContent).toContain('Failed to load prompts');

            // Step 3: Show success notification after recovery
            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ prompts: [] })
            });

            errorHandler.showSuccess('Prompts loaded successfully');
            
            const successNotification = container.querySelector('.notification.success');
            expect(successNotification).toBeTruthy();
            expect(successNotification.textContent).toContain('Prompts loaded successfully');

            // Step 4: Handle invalid user input
            const favoritesManager = new FavoritesManager();
            
            expect(() => favoritesManager.createCollection('')).toThrow('Collection name is required');
            expect(() => favoritesManager.createCollection('   ')).toThrow('Collection name is required');
        });
    });

    describe('User Journey: Mobile Responsive Interactions', () => {
        it('should work correctly on mobile devices', async () => {
            // Mock mobile viewport
            Object.defineProperty(window, 'innerWidth', {
                writable: true,
                configurable: true,
                value: 375,
            });

            const promptManager = new PromptManager();
            await promptManager.loadPrompts();
            promptManager.renderPrompts(promptManager.prompts);

            // Step 1: Test touch interactions
            const grid = document.getElementById('unifiedGrid');
            const cards = grid.querySelectorAll('.prompt-card');
            expect(cards).toHaveLength(2);

            // Step 2: Test mobile-friendly buttons
            const favoriteBtn = cards[0].querySelector('.favorite-btn');
            const copyBtn = cards[0].querySelector('.copy-btn');
            const rateBtn = cards[0].querySelector('.rate-btn');

            // All buttons should be present and clickable
            expect(favoriteBtn).toBeTruthy();
            expect(copyBtn).toBeTruthy();
            expect(rateBtn).toBeTruthy();

            // Step 3: Test mobile search
            const searchInput = document.getElementById('searchInput');
            searchInput.value = 'test';
            searchInput.dispatchEvent(new Event('input'));

            // Step 4: Test mobile filters
            const filters = document.querySelectorAll('.filter-chip');
            expect(filters.length).toBeGreaterThan(0);

            // Touch events should work
            filters[0].dispatchEvent(new Event('touchstart'));
            filters[0].dispatchEvent(new Event('touchend'));
        });
    });

    describe('User Journey: Performance and Optimization', () => {
        it('should handle large datasets efficiently', async () => {
            // Mock large dataset
            const largePrompts = Array.from({ length: 1000 }, (_, i) => ({
                id: i.toString(),
                title: `Prompt ${i}`,
                content: `Content for prompt ${i}`,
                description: `Description for prompt ${i}`,
                category: i % 2 === 0 ? 'development' : 'creative',
                author: `user${i % 10}`,
                average_rating: Math.random() * 5,
                total_ratings: Math.floor(Math.random() * 100),
                is_featured: i % 10 === 0,
                difficulty_level: ['beginner', 'intermediate', 'advanced'][i % 3],
                tags: [`tag${i % 5}`, `tag${(i + 1) % 5}`]
            }));

            global.fetch.mockResolvedValue({
                ok: true,
                json: async () => ({ prompts: largePrompts })
            });

            const promptManager = new PromptManager();
            
            // Step 1: Load large dataset
            const startTime = performance.now();
            await promptManager.loadPrompts();
            const loadTime = performance.now() - startTime;

            expect(promptManager.prompts).toHaveLength(1000);
            expect(loadTime).toBeLessThan(1000); // Should load within 1 second

            // Step 2: Filter large dataset
            const filterStartTime = performance.now();
            const filteredPrompts = promptManager.filterPrompts({ category: 'development' });
            const filterTime = performance.now() - filterStartTime;

            expect(filteredPrompts).toHaveLength(500); // Half should be development
            expect(filterTime).toBeLessThan(100); // Should filter quickly

            // Step 3: Search large dataset
            const searchStartTime = performance.now();
            const searchResults = promptManager.filterPrompts({ query: 'Prompt 1' });
            const searchTime = performance.now() - searchStartTime;

            expect(searchResults.length).toBeGreaterThan(0);
            expect(searchTime).toBeLessThan(100); // Should search quickly
        });
    });

    describe('User Journey: Data Persistence', () => {
        it('should persist user data across sessions', async () => {
            const favoritesManager = new FavoritesManager();

            // Step 1: Add favorites and collections
            favoritesManager.addToFavorites('1');
            favoritesManager.addToFavorites('2');
            const collection = favoritesManager.createCollection('My Collection');
            favoritesManager.addToCollection(collection.id, '1');

            // Step 2: Simulate page reload by creating new manager
            localStorageMock.getItem.mockImplementation((key) => {
                if (key === 'promptHero_favorites') return JSON.stringify(['1', '2']);
                if (key === 'promptHero_collections') return JSON.stringify([collection]);
                return null;
            });

            const newFavoritesManager = new FavoritesManager();

            // Step 3: Verify data persistence
            expect(newFavoritesManager.favorites).toEqual(['1', '2']);
            expect(newFavoritesManager.getAllCollections()).toHaveLength(1);
            expect(newFavoritesManager.getCollection(collection.id)).toBeDefined();
            expect(newFavoritesManager.getCollection(collection.id).prompts).toEqual(['1']);
        });
    });

    describe('User Journey: Accessibility', () => {
        it('should be accessible to users with disabilities', async () => {
            const promptManager = new PromptManager();
            await promptManager.loadPrompts();
            promptManager.renderPrompts(promptManager.prompts);

            // Step 1: Check for proper ARIA labels
            const grid = document.getElementById('unifiedGrid');
            const cards = grid.querySelectorAll('.prompt-card');
            
            expect(cards[0].getAttribute('role')).toBe('article');
            expect(cards[0].getAttribute('aria-label')).toBeTruthy();

            // Step 2: Check for keyboard navigation
            const favoriteBtn = cards[0].querySelector('.favorite-btn');
            expect(favoriteBtn.getAttribute('tabindex')).toBe('0');
            expect(favoriteBtn.getAttribute('aria-label')).toBeTruthy();

            // Step 3: Check for screen reader support
            const rating = cards[0].querySelector('.prompt-rating');
            expect(rating.getAttribute('aria-label')).toContain('rating');

            // Step 4: Test keyboard interactions
            favoriteBtn.focus();
            expect(document.activeElement).toBe(favoriteBtn);

            // Simulate Enter key press
            const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' });
            favoriteBtn.dispatchEvent(enterEvent);
        });
    });
});
