// Frontend Tests for Prompt Manager
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

// Mock console methods to avoid test output noise
global.console = {
    ...console,
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
};

describe('PromptManager', () => {
    let PromptManager;

    beforeEach(async () => {
        // Clear all mocks
        vi.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);
        
        // Reset DOM
        document.getElementById('unifiedGrid').innerHTML = '';
        document.getElementById('searchResultsInfo').style.display = 'none';
        
        // Mock successful fetch for prompts.json
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                prompts: [
                    {
                        id: '1',
                        title: 'Test Prompt 1',
                        content: 'Test content 1',
                        description: 'Test description 1',
                        category: 'development',
                        author: 'testuser',
                        average_rating: 4.5,
                        total_ratings: 10,
                        is_featured: true,
                        difficulty_level: 'intermediate',
                        tags: ['ai', 'coding']
                    },
                    {
                        id: '2',
                        title: 'Test Prompt 2',
                        content: 'Test content 2',
                        description: 'Test description 2',
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

        // Dynamically import PromptManager after setting up mocks
        const module = await import('../../docs/js/prompt-manager.js');
        PromptManager = module.default;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with empty favorites and collections', () => {
            const manager = new PromptManager();
            expect(manager.favorites).toEqual([]);
            expect(manager.collections).toEqual([]);
        });

        it('should load favorites from localStorage', () => {
            localStorageMock.getItem.mockReturnValue(JSON.stringify(['1', '2']));
            const manager = new PromptManager();
            expect(manager.favorites).toEqual(['1', '2']);
        });

        it('should handle invalid localStorage data gracefully', () => {
            localStorageMock.getItem.mockReturnValue('invalid json');
            const manager = new PromptManager();
            expect(manager.favorites).toEqual([]);
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('Prompt Loading', () => {
        it('should load prompts from API', async () => {
            const manager = new PromptManager();
            const prompts = await manager.loadPrompts();
            
            expect(fetch).toHaveBeenCalledWith('prompts.json');
            expect(prompts).toHaveLength(2);
            expect(prompts[0].title).toBe('Test Prompt 1');
        });

        it('should fallback to mock data when API fails', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));
            
            const manager = new PromptManager();
            const prompts = await manager.loadPrompts();
            
            expect(prompts).toHaveLength(5); // Mock data has 5 prompts
            expect(prompts[0].title).toBe('AI Code Review Assistant');
        });

        it('should handle fetch errors gracefully', async () => {
            global.fetch.mockRejectedValue(new Error('Network error'));
            
            const manager = new PromptManager();
            const prompts = await manager.loadPrompts();
            
            expect(prompts).toBeDefined();
            expect(Array.isArray(prompts)).toBe(true);
        });
    });

    describe('Prompt Card Creation', () => {
        it('should create a prompt card element', () => {
            const manager = new PromptManager();
            const prompt = {
                id: '1',
                title: 'Test Prompt',
                content: 'Test content',
                description: 'Test description',
                category: 'development',
                author: 'testuser',
                average_rating: 4.5,
                total_ratings: 10,
                is_featured: true,
                difficulty_level: 'intermediate',
                tags: ['ai', 'coding']
            };

            const card = manager.createPromptCard(prompt);
            
            expect(card).toBeInstanceOf(HTMLElement);
            expect(card.className).toBe('prompt-card');
            expect(card.dataset.promptId).toBe('1');
            expect(card.querySelector('h3').textContent).toBe('Test Prompt');
        });

        it('should display correct rating stars', () => {
            const manager = new PromptManager();
            const prompt = {
                id: '1',
                title: 'Test Prompt',
                content: 'Test content',
                description: 'Test description',
                category: 'development',
                author: 'testuser',
                average_rating: 4.5,
                total_ratings: 10
            };

            const card = manager.createPromptCard(prompt);
            const stars = card.querySelector('.stars');
            
            expect(stars.textContent).toContain('★');
            expect(stars.textContent).toContain('☆');
        });

        it('should show favorited state correctly', () => {
            const manager = new PromptManager();
            manager.favorites = ['1'];
            
            const prompt = {
                id: '1',
                title: 'Test Prompt',
                content: 'Test content',
                description: 'Test description',
                category: 'development',
                author: 'testuser',
                average_rating: 4.5,
                total_ratings: 10
            };

            const card = manager.createPromptCard(prompt);
            const favoriteBtn = card.querySelector('.favorite-btn');
            
            expect(favoriteBtn.classList.contains('favorited')).toBe(true);
            expect(favoriteBtn.textContent).toBe('❤️');
        });
    });

    describe('Prompt Filtering', () => {
        beforeEach(async () => {
            const manager = new PromptManager();
            await manager.loadPrompts();
        });

        it('should filter prompts by category', () => {
            const manager = new PromptManager();
            manager.prompts = [
                { id: '1', category: 'development', title: 'Dev Prompt' },
                { id: '2', category: 'creative', title: 'Creative Prompt' }
            ];

            const filtered = manager.filterPrompts({ category: 'development' });
            
            expect(filtered).toHaveLength(1);
            expect(filtered[0].category).toBe('development');
        });

        it('should filter featured prompts', () => {
            const manager = new PromptManager();
            manager.prompts = [
                { id: '1', is_featured: true, title: 'Featured Prompt' },
                { id: '2', is_featured: false, title: 'Regular Prompt' }
            ];

            const filtered = manager.filterPrompts({ featured: true });
            
            expect(filtered).toHaveLength(1);
            expect(filtered[0].is_featured).toBe(true);
        });

        it('should filter by difficulty level', () => {
            const manager = new PromptManager();
            manager.prompts = [
                { id: '1', difficulty_level: 'beginner', title: 'Beginner Prompt' },
                { id: '2', difficulty_level: 'advanced', title: 'Advanced Prompt' }
            ];

            const filtered = manager.filterPrompts({ difficulty: 'beginner' });
            
            expect(filtered).toHaveLength(1);
            expect(filtered[0].difficulty_level).toBe('beginner');
        });

        it('should search prompts by query', () => {
            const manager = new PromptManager();
            manager.prompts = [
                { id: '1', title: 'AI Code Review', description: 'Review code with AI' },
                { id: '2', title: 'Creative Writing', description: 'Write creative content' }
            ];

            const filtered = manager.filterPrompts({ query: 'code' });
            
            expect(filtered).toHaveLength(1);
            expect(filtered[0].title).toBe('AI Code Review');
        });

        it('should sort prompts by rating', () => {
            const manager = new PromptManager();
            manager.prompts = [
                { id: '1', average_rating: 3.5, title: 'Low Rating' },
                { id: '2', average_rating: 4.8, title: 'High Rating' }
            ];

            const filtered = manager.filterPrompts({ sort: 'rating' });
            
            expect(filtered[0].average_rating).toBe(4.8);
            expect(filtered[1].average_rating).toBe(3.5);
        });
    });

    describe('Prompt Rendering', () => {
        it('should render prompts to the grid', () => {
            const manager = new PromptManager();
            const prompts = [
                {
                    id: '1',
                    title: 'Test Prompt 1',
                    content: 'Test content 1',
                    description: 'Test description 1',
                    category: 'development',
                    author: 'testuser',
                    average_rating: 4.5,
                    total_ratings: 10
                }
            ];

            manager.renderPrompts(prompts);
            
            const grid = document.getElementById('unifiedGrid');
            const cards = grid.querySelectorAll('.prompt-card');
            
            expect(cards).toHaveLength(1);
            expect(cards[0].querySelector('h3').textContent).toBe('Test Prompt 1');
        });

        it('should show no results message when no prompts', () => {
            const manager = new PromptManager();
            manager.renderPrompts([]);
            
            const grid = document.getElementById('unifiedGrid');
            const noResults = grid.querySelector('.no-results');
            
            expect(noResults).toBeTruthy();
            expect(noResults.querySelector('h3').textContent).toBe('No prompts found');
        });

        it('should handle missing container gracefully', () => {
            const manager = new PromptManager();
            const prompts = [{ id: '1', title: 'Test' }];
            
            // Remove the container
            const container = document.getElementById('unifiedGrid');
            container.remove();
            
            // Should not throw error
            expect(() => manager.renderPrompts(prompts)).not.toThrow();
        });
    });

    describe('Star Rating Generation', () => {
        it('should generate correct star display for full rating', () => {
            const manager = new PromptManager();
            const stars = manager.generateStars(5);
            
            expect(stars).toBe('★★★★★');
        });

        it('should generate correct star display for partial rating', () => {
            const manager = new PromptManager();
            const stars = manager.generateStars(3.5);
            
            expect(stars).toBe('★★★☆');
        });

        it('should generate correct star display for zero rating', () => {
            const manager = new PromptManager();
            const stars = manager.generateStars(0);
            
            expect(stars).toBe('☆☆☆☆☆');
        });
    });

    describe('HTML Escaping', () => {
        it('should escape HTML in prompt content', () => {
            const manager = new PromptManager();
            const prompt = {
                id: '1',
                title: 'Test <script>alert("xss")</script>',
                content: 'Test content',
                description: 'Test description',
                category: 'development',
                author: 'testuser',
                average_rating: 4.5,
                total_ratings: 10
            };

            const card = manager.createPromptCard(prompt);
            const title = card.querySelector('h3');
            
            expect(title.innerHTML).not.toContain('<script>');
            expect(title.textContent).toContain('Test');
        });
    });

    describe('Error Handling', () => {
        it('should handle missing prompt data gracefully', () => {
            const manager = new PromptManager();
            
            expect(() => manager.createPromptCard(null)).not.toThrow();
            expect(() => manager.createPromptCard(undefined)).not.toThrow();
        });

        it('should handle invalid prompt data', () => {
            const manager = new PromptManager();
            const invalidPrompt = {
                id: '1',
                // Missing required fields
            };

            const card = manager.createPromptCard(invalidPrompt);
            
            expect(card).toBeInstanceOf(HTMLElement);
            expect(card.querySelector('h3').textContent).toBe('');
        });
    });
});
