// API Tests for Prompts Endpoints
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMocks } from 'node-mocks-http';
import handler from '../../api/prompts/index.js';

// Mock the database
const mockSql = {
    query: vi.fn()
};

vi.mock('@vercel/postgres', () => ({
    sql: mockSql
}));

describe('/api/prompts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('GET /api/prompts', () => {
        it('should return prompts with pagination', async () => {
            const mockPrompts = [
                {
                    id: '1',
                    title: 'Test Prompt',
                    content: 'Test content',
                    category: 'development',
                    author_username: 'testuser',
                    total_ratings: 5,
                    total_favorites: 3
                }
            ];

            mockSql.query
                .mockResolvedValueOnce({ rows: mockPrompts })
                .mockResolvedValueOnce({ rows: [{ total: '1' }] });

            const { req, res } = createMocks({
                method: 'GET',
                query: { page: 1, limit: 20 }
            });

            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.prompts).toHaveLength(1);
            expect(data.pagination).toBeDefined();
            expect(data.pagination.page).toBe(1);
        });

        it('should filter prompts by category', async () => {
            mockSql.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ total: '0' }] });

            const { req, res } = createMocks({
                method: 'GET',
                query: { category: 'development' }
            });

            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            expect(mockSql.query).toHaveBeenCalledWith(
                expect.stringContaining('AND p.category = $1'),
                ['development']
            );
        });

        it('should search prompts by query', async () => {
            mockSql.query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{ total: '0' }] });

            const { req, res } = createMocks({
                method: 'GET',
                query: { search: 'test query' }
            });

            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            expect(mockSql.query).toHaveBeenCalledWith(
                expect.stringContaining('ILIKE'),
                expect.arrayContaining(['%test query%'])
            );
        });

        it('should handle database errors', async () => {
            mockSql.query.mockRejectedValue(new Error('Database error'));

            const { req, res } = createMocks({
                method: 'GET'
            });

            await handler(req, res);

            expect(res._getStatusCode()).toBe(500);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Failed to fetch prompts');
        });
    });

    describe('POST /api/prompts', () => {
        it('should create a new prompt', async () => {
            const newPrompt = {
                id: '1',
                title: 'New Prompt',
                content: 'This is a new prompt with enough content to pass validation',
                category: 'development',
                author_id: '00000000-0000-0000-0000-000000000000',
                created_at: '2024-01-15T10:30:00Z',
                updated_at: '2024-01-15T10:30:00Z',
                is_public: true,
                is_featured: false,
                usage_count: 0,
                view_count: 0,
                average_rating: 0,
                total_ratings: 0,
                total_favorites: 0,
                difficulty_level: 'intermediate',
                estimated_tokens: 50,
                language: 'en',
                version: 1
            };

            mockSql.query.mockResolvedValue({ rows: [newPrompt] });

            const { req, res } = createMocks({
                method: 'POST',
                body: {
                    title: 'New Prompt',
                    content: 'This is a new prompt with enough content to pass validation',
                    category: 'development',
                    tags: ['ai', 'coding'],
                    difficulty_level: 'intermediate',
                    is_public: true
                }
            });

            await handler(req, res);

            expect(res._getStatusCode()).toBe(201);
            const data = JSON.parse(res._getData());
            expect(data.prompt.title).toBe('New Prompt');
            expect(data.message).toBe('Prompt created successfully');
        });

        it('should validate required fields', async () => {
            const { req, res } = createMocks({
                method: 'POST',
                body: {
                    title: 'Short', // Too short
                    content: 'Short' // Too short
                }
            });

            await handler(req, res);

            expect(res._getStatusCode()).toBe(400);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Validation failed');
            expect(data.details).toBeDefined();
        });

        it('should validate category', async () => {
            const { req, res } = createMocks({
                method: 'POST',
                body: {
                    title: 'Valid Title That Is Long Enough',
                    content: 'This is a valid content that is long enough to pass validation requirements',
                    category: 'invalid-category'
                }
            });

            await handler(req, res);

            expect(res._getStatusCode()).toBe(400);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Validation failed');
        });

        it('should handle database errors during creation', async () => {
            mockSql.query.mockRejectedValue(new Error('Database error'));

            const { req, res } = createMocks({
                method: 'POST',
                body: {
                    title: 'Valid Title That Is Long Enough',
                    content: 'This is a valid content that is long enough to pass validation requirements',
                    category: 'development'
                }
            });

            await handler(req, res);

            expect(res._getStatusCode()).toBe(500);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Failed to create prompt');
        });
    });

    describe('PUT /api/prompts', () => {
        it('should update an existing prompt', async () => {
            const updatedPrompt = {
                id: '1',
                title: 'Updated Prompt',
                content: 'Updated content',
                category: 'creative',
                updated_at: '2024-01-15T11:45:00Z'
            };

            mockSql.query
                .mockResolvedValueOnce({ rows: [{ id: '1' }] }) // Check if exists
                .mockResolvedValueOnce({ rows: [updatedPrompt] }); // Update

            const { req, res } = createMocks({
                method: 'PUT',
                query: { id: '1' },
                body: {
                    title: 'Updated Prompt',
                    content: 'Updated content',
                    category: 'creative'
                }
            });

            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.prompt.title).toBe('Updated Prompt');
            expect(data.message).toBe('Prompt updated successfully');
        });

        it('should return 404 for non-existent prompt', async () => {
            mockSql.query.mockResolvedValue({ rows: [] });

            const { req, res } = createMocks({
                method: 'PUT',
                query: { id: 'non-existent' },
                body: {
                    title: 'Updated Title'
                }
            });

            await handler(req, res);

            expect(res._getStatusCode()).toBe(404);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Prompt not found');
        });

        it('should validate update data', async () => {
            const { req, res } = createMocks({
                method: 'PUT',
                query: { id: '1' },
                body: {
                    title: 'Short' // Too short
                }
            });

            await handler(req, res);

            expect(res._getStatusCode()).toBe(400);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Validation failed');
        });
    });

    describe('DELETE /api/prompts', () => {
        it('should delete an existing prompt', async () => {
            mockSql.query
                .mockResolvedValueOnce({ rows: [{ id: '1' }] }) // Check if exists
                .mockResolvedValueOnce({ rows: [] }); // Delete

            const { req, res } = createMocks({
                method: 'DELETE',
                query: { id: '1' }
            });

            await handler(req, res);

            expect(res._getStatusCode()).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.message).toBe('Prompt deleted successfully');
        });

        it('should return 404 for non-existent prompt', async () => {
            mockSql.query.mockResolvedValue({ rows: [] });

            const { req, res } = createMocks({
                method: 'DELETE',
                query: { id: 'non-existent' }
            });

            await handler(req, res);

            expect(res._getStatusCode()).toBe(404);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Prompt not found');
        });
    });

    describe('Method not allowed', () => {
        it('should return 405 for unsupported methods', async () => {
            const { req, res } = createMocks({
                method: 'PATCH'
            });

            await handler(req, res);

            expect(res._getStatusCode()).toBe(405);
            const data = JSON.parse(res._getData());
            expect(data.error).toBe('Method not allowed');
        });
    });
});
