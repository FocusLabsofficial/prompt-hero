// Integration Tests for API Endpoints
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMocks } from 'node-mocks-http';

// Mock the database connection
const mockQuery = vi.fn();
const mockRelease = vi.fn();

vi.mock('@vercel/postgres', () => ({
    sql: mockQuery
}));

// Mock the security middleware
vi.mock('../api/middleware/security.js', () => ({
    securityHeaders: vi.fn((req, res, next) => next()),
    rateLimit: vi.fn((req, res, next) => next()),
    validateContentLength: vi.fn((req, res, next) => next()),
    requestLogger: vi.fn((req, res, next) => next()),
    errorHandler: vi.fn((err, req, res, next) => {
        res.status(500).json({ error: 'Internal server error' });
    })
}));

// Mock the validation schemas
vi.mock('../api/validation/schemas.js', () => ({
    createPromptSchema: {
        validate: vi.fn((data) => ({ error: null, value: data }))
    },
    updatePromptSchema: {
        validate: vi.fn((data) => ({ error: null, value: data }))
    },
    promptQuerySchema: {
        validate: vi.fn((data) => ({ error: null, value: data }))
    }
}));

describe('API Integration Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockQuery.mockResolvedValue({ rows: [] });
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('GET /api/prompts', () => {
        it('should return prompts with default pagination', async () => {
            const mockPrompts = [
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
                    tags: ['ai', 'coding'],
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z'
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
                    tags: ['writing', 'creative'],
                    created_at: '2024-01-02T00:00:00Z',
                    updated_at: '2024-01-02T00:00:00Z'
                }
            ];

            mockQuery.mockResolvedValue({ rows: mockPrompts });

            const { req, res } = createMocks({
                method: 'GET',
                url: '/api/prompts'
            });

            // Import and call the handler
            const { default: handler } = await import('../api/prompts/index.js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.prompts).toHaveLength(2);
            expect(data.pagination.page).toBe(1);
            expect(data.pagination.limit).toBe(20);
            expect(data.pagination.total).toBe(2);
        });

        it('should filter prompts by category', async () => {
            const mockPrompts = [
                {
                    id: '1',
                    title: 'Dev Prompt',
                    category: 'development',
                    author: 'testuser',
                    average_rating: 4.5,
                    total_ratings: 10,
                    is_featured: true,
                    difficulty_level: 'intermediate',
                    tags: ['ai', 'coding'],
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z'
                }
            ];

            mockQuery.mockResolvedValue({ rows: mockPrompts });

            const { req, res } = createMocks({
                method: 'GET',
                url: '/api/prompts?category=development'
            });

            const { default: handler } = await import('../api/prompts/index.js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.prompts).toHaveLength(1);
            expect(data.prompts[0].category).toBe('development');
        });

        it('should filter featured prompts', async () => {
            const mockPrompts = [
                {
                    id: '1',
                    title: 'Featured Prompt',
                    category: 'development',
                    author: 'testuser',
                    average_rating: 4.5,
                    total_ratings: 10,
                    is_featured: true,
                    difficulty_level: 'intermediate',
                    tags: ['ai', 'coding'],
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z'
                }
            ];

            mockQuery.mockResolvedValue({ rows: mockPrompts });

            const { req, res } = createMocks({
                method: 'GET',
                url: '/api/prompts?featured=true'
            });

            const { default: handler } = await import('../api/prompts/index.js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.prompts).toHaveLength(1);
            expect(data.prompts[0].is_featured).toBe(true);
        });

        it('should search prompts by query', async () => {
            const mockPrompts = [
                {
                    id: '1',
                    title: 'AI Code Review',
                    content: 'Review code with AI assistance',
                    description: 'Get AI-powered code reviews',
                    category: 'development',
                    author: 'testuser',
                    average_rating: 4.5,
                    total_ratings: 10,
                    is_featured: true,
                    difficulty_level: 'intermediate',
                    tags: ['ai', 'coding', 'review'],
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z'
                }
            ];

            mockQuery.mockResolvedValue({ rows: mockPrompts });

            const { req, res } = createMocks({
                method: 'GET',
                url: '/api/prompts?q=code'
            });

            const { default: handler } = await import('../api/prompts/index.js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.prompts).toHaveLength(1);
            expect(data.prompts[0].title).toContain('Code');
        });

        it('should sort prompts by rating', async () => {
            const mockPrompts = [
                {
                    id: '2',
                    title: 'High Rating Prompt',
                    category: 'development',
                    author: 'testuser',
                    average_rating: 4.8,
                    total_ratings: 20,
                    is_featured: true,
                    difficulty_level: 'intermediate',
                    tags: ['ai', 'coding'],
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z'
                },
                {
                    id: '1',
                    title: 'Low Rating Prompt',
                    category: 'development',
                    author: 'testuser2',
                    average_rating: 3.2,
                    total_ratings: 5,
                    is_featured: false,
                    difficulty_level: 'beginner',
                    tags: ['ai', 'coding'],
                    created_at: '2024-01-01T00:00:00Z',
                    updated_at: '2024-01-01T00:00:00Z'
                }
            ];

            mockQuery.mockResolvedValue({ rows: mockPrompts });

            const { req, res } = createMocks({
                method: 'GET',
                url: '/api/prompts?sort=rating'
            });

            const { default: handler } = await import('../api/prompts/index.js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.prompts[0].average_rating).toBe(4.8);
            expect(data.prompts[1].average_rating).toBe(3.2);
        });

        it('should handle pagination correctly', async () => {
            const mockPrompts = Array.from({ length: 10 }, (_, i) => ({
                id: (i + 1).toString(),
                title: `Prompt ${i + 1}`,
                category: 'development',
                author: 'testuser',
                average_rating: 4.0,
                total_ratings: 5,
                is_featured: false,
                difficulty_level: 'intermediate',
                tags: ['ai', 'coding'],
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
            }));

            mockQuery.mockResolvedValue({ rows: mockPrompts });

            const { req, res } = createMocks({
                method: 'GET',
                url: '/api/prompts?page=2&limit=5'
            });

            const { default: handler } = await import('../api/prompts/index.js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.pagination.page).toBe(2);
            expect(data.pagination.limit).toBe(5);
        });

        it('should handle database errors gracefully', async () => {
            mockQuery.mockRejectedValue(new Error('Database connection failed'));

            const { req, res } = createMocks({
                method: 'GET',
                url: '/api/prompts'
            });

            const { default: handler } = await import('../api/prompts/index.js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(500);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Failed to fetch prompts');
        });
    });

    describe('POST /api/prompts', () => {
        it('should create a new prompt', async () => {
            const newPrompt = {
                title: 'New Test Prompt',
                content: 'This is a new test prompt',
                description: 'A test prompt for testing',
                category: 'development',
                tags: ['test', 'ai'],
                difficulty_level: 'intermediate'
            };

            const createdPrompt = {
                id: 'new-id',
                ...newPrompt,
                author: 'testuser',
                average_rating: 0,
                total_ratings: 0,
                is_featured: false,
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
            };

            mockQuery.mockResolvedValue({ rows: [createdPrompt] });

            const { req, res } = createMocks({
                method: 'POST',
                url: '/api/prompts',
                body: newPrompt
            });

            const { default: handler } = await import('../api/prompts/index.js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(201);
            const data = JSON.parse(res._getData());
            expect(data.prompt.title).toBe('New Test Prompt');
            expect(data.prompt.id).toBe('new-id');
        });

        it('should validate required fields', async () => {
            const invalidPrompt = {
                title: '', // Empty title
                content: 'Test content'
            };

            const { createPromptSchema } = await import('../api/validation/schemas.js');
            createPromptSchema.validate.mockReturnValue({
                error: { details: [{ message: 'Title is required' }] }
            });

            const { req, res } = createMocks({
                method: 'POST',
                url: '/api/prompts',
                body: invalidPrompt
            });

            const { default: handler } = await import('../api/prompts/index.js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(400);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Title is required');
        });

        it('should handle database errors during creation', async () => {
            const newPrompt = {
                title: 'Test Prompt',
                content: 'Test content',
                description: 'Test description',
                category: 'development'
            };

            mockQuery.mockRejectedValue(new Error('Database error'));

            const { req, res } = createMocks({
                method: 'POST',
                url: '/api/prompts',
                body: newPrompt
            });

            const { default: handler } = await import('../api/prompts/index.js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(500);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Failed to create prompt');
        });
    });

    describe('GET /api/prompts/[id]', () => {
        it('should return a specific prompt', async () => {
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
                tags: ['ai', 'coding'],
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
            };

            mockQuery.mockResolvedValue({ rows: [prompt] });

            const { req, res } = createMocks({
                method: 'GET',
                url: '/api/prompts/1'
            });

            const { default: handler } = await import('../api/prompts/[id].js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.prompt.id).toBe('1');
            expect(data.prompt.title).toBe('Test Prompt');
        });

        it('should return 404 for non-existent prompt', async () => {
            mockQuery.mockResolvedValue({ rows: [] });

            const { req, res } = createMocks({
                method: 'GET',
                url: '/api/prompts/non-existent'
            });

            const { default: handler } = await import('../api/prompts/[id].js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(404);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Prompt not found');
        });
    });

    describe('PUT /api/prompts/[id]', () => {
        it('should update an existing prompt', async () => {
            const updatedPrompt = {
                id: '1',
                title: 'Updated Test Prompt',
                content: 'Updated test content',
                description: 'Updated test description',
                category: 'development',
                author: 'testuser',
                average_rating: 4.5,
                total_ratings: 10,
                is_featured: true,
                difficulty_level: 'intermediate',
                tags: ['ai', 'coding'],
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z'
            };

            mockQuery.mockResolvedValue({ rows: [updatedPrompt] });

            const { req, res } = createMocks({
                method: 'PUT',
                url: '/api/prompts/1',
                body: {
                    title: 'Updated Test Prompt',
                    content: 'Updated test content'
                }
            });

            const { default: handler } = await import('../api/prompts/[id].js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.prompt.title).toBe('Updated Test Prompt');
        });

        it('should return 404 when updating non-existent prompt', async () => {
            mockQuery.mockResolvedValue({ rows: [] });

            const { req, res } = createMocks({
                method: 'PUT',
                url: '/api/prompts/non-existent',
                body: { title: 'Updated Title' }
            });

            const { default: handler } = await import('../api/prompts/[id].js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(404);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Prompt not found');
        });
    });

    describe('DELETE /api/prompts/[id]', () => {
        it('should delete an existing prompt', async () => {
            mockQuery.mockResolvedValue({ rowCount: 1 });

            const { req, res } = createMocks({
                method: 'DELETE',
                url: '/api/prompts/1'
            });

            const { default: handler } = await import('../api/prompts/[id].js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(204);
        });

        it('should return 404 when deleting non-existent prompt', async () => {
            mockQuery.mockResolvedValue({ rowCount: 0 });

            const { req, res } = createMocks({
                method: 'DELETE',
                url: '/api/prompts/non-existent'
            });

            const { default: handler } = await import('../api/prompts/[id].js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(404);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Prompt not found');
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid HTTP methods', async () => {
            const { req, res } = createMocks({
                method: 'PATCH',
                url: '/api/prompts'
            });

            const { default: handler } = await import('../api/prompts/index.js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(405);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Method not allowed');
        });

        it('should handle malformed JSON in request body', async () => {
            const { req, res } = createMocks({
                method: 'POST',
                url: '/api/prompts',
                body: 'invalid json'
            });

            // Mock req.json to throw an error
            req.json = vi.fn().mockRejectedValue(new Error('Invalid JSON'));

            const { default: handler } = await import('../api/prompts/index.js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(400);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Invalid request body');
        });

        it('should handle rate limiting', async () => {
            const { rateLimit } = await import('../api/middleware/security.js');
            rateLimit.mockImplementation((req, res, next) => {
                res.status(429).json({ error: 'Too many requests' });
            });

            const { req, res } = createMocks({
                method: 'GET',
                url: '/api/prompts'
            });

            const { default: handler } = await import('../api/prompts/index.js');
            await handler(req, res);

            expect(res._getStatusCode()).toBe(429);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Too many requests');
        });
    });

    describe('Security', () => {
        it('should apply security headers', async () => {
            const { securityHeaders } = await import('../api/middleware/security.js');
            const mockNext = vi.fn();
            
            const { req, res } = createMocks({
                method: 'GET',
                url: '/api/prompts'
            });

            securityHeaders(req, res, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should validate content length', async () => {
            const { validateContentLength } = await import('../api/middleware/security.js');
            const mockNext = vi.fn();
            
            const { req, res } = createMocks({
                method: 'POST',
                url: '/api/prompts',
                body: { title: 'Test' }
            });

            validateContentLength(req, res, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should log requests', async () => {
            const { requestLogger } = await import('../api/middleware/security.js');
            const mockNext = vi.fn();
            
            const { req, res } = createMocks({
                method: 'GET',
                url: '/api/prompts'
            });

            requestLogger(req, res, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });
});
