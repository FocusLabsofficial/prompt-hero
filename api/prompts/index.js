// API endpoint for prompts CRUD operations
import { sql } from '@vercel/postgres';
import { 
    securityHeaders, 
    rateLimit, 
    validateInput, 
    validateContentLength,
    requestLogger,
    errorHandler 
} from '../middleware/security.js';
import { 
    createPromptSchema, 
    updatePromptSchema, 
    promptQuerySchema 
} from '../validation/schemas.js';

export default async function handler(req, res) {
    // Apply security middleware
    if (securityHeaders(req, res)) return;
    
    requestLogger(req, res);
    validateContentLength(10000)(req, res);
    rateLimit(100, 15 * 60 * 1000)(req, res); // 100 requests per 15 minutes

    try {
        switch (req.method) {
            case 'GET':
                return await handleGet(req, res);
            case 'POST':
                return await handlePost(req, res);
            case 'PUT':
                return await handlePut(req, res);
            case 'DELETE':
                return await handleDelete(req, res);
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        return errorHandler(error, req, res);
    }
}

// GET /api/prompts - List prompts with filtering and pagination
async function handleGet(req, res) {
    const { 
        page = 1, 
        limit = 20, 
        category, 
        search, 
        sort = 'created_at',
        order = 'desc',
        featured,
        difficulty,
        trending
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    try {
        let query = `
            SELECT 
                p.*,
                u.username as author_username,
                u.display_name as author_display_name,
                u.avatar_url as author_avatar_url,
                COUNT(DISTINCT r.id) as total_ratings,
                COUNT(DISTINCT f.user_id) as total_favorites
            FROM prompts p
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN ratings r ON p.id = r.prompt_id
            LEFT JOIN favorites f ON p.id = f.prompt_id
            WHERE p.is_public = true
        `;
        
        const params = [];
        let paramCount = 0;

        // Add filters
        if (category && category !== 'all') {
            paramCount++;
            query += ` AND p.category = $${paramCount}`;
            params.push(category);
        }

        if (search) {
            paramCount++;
            query += ` AND (
                p.title ILIKE $${paramCount} OR 
                p.description ILIKE $${paramCount} OR 
                p.content ILIKE $${paramCount} OR
                EXISTS (
                    SELECT 1 FROM unnest(p.tags) as tag 
                    WHERE tag ILIKE $${paramCount}
                )
            )`;
            params.push(`%${search}%`);
        }

        if (featured === 'true') {
            query += ` AND p.is_featured = true`;
        }

        if (difficulty) {
            paramCount++;
            query += ` AND p.difficulty_level = $${paramCount}`;
            params.push(difficulty);
        }

        if (trending === 'true') {
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            query += ` AND p.created_at > '${oneWeekAgo}' AND p.usage_count > 10`;
        }

        // Group by prompt fields
        query += ` GROUP BY p.id, u.username, u.display_name, u.avatar_url`;

        // Add sorting
        const validSortFields = ['created_at', 'updated_at', 'title', 'average_rating', 'usage_count', 'total_ratings'];
        const sortField = validSortFields.includes(sort) ? sort : 'created_at';
        const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        
        if (trending === 'true') {
            query += ` ORDER BY (p.usage_count + COUNT(DISTINCT f.user_id)) DESC`;
        } else {
            query += ` ORDER BY p.${sortField} ${sortOrder}`;
        }

        // Add pagination
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(parseInt(limit));
        
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(offset);

        const { rows: prompts } = await sql.query(query, params);

        // Get total count for pagination
        let countQuery = `
            SELECT COUNT(DISTINCT p.id) as total
            FROM prompts p
            WHERE p.is_public = true
        `;
        
        const countParams = [];
        let countParamCount = 0;

        if (category && category !== 'all') {
            countParamCount++;
            countQuery += ` AND p.category = $${countParamCount}`;
            countParams.push(category);
        }

        if (search) {
            countParamCount++;
            countQuery += ` AND (
                p.title ILIKE $${countParamCount} OR 
                p.description ILIKE $${countParamCount} OR 
                p.content ILIKE $${countParamCount} OR
                EXISTS (
                    SELECT 1 FROM unnest(p.tags) as tag 
                    WHERE tag ILIKE $${countParamCount}
                )
            )`;
            countParams.push(`%${search}%`);
        }

        if (featured === 'true') {
            countQuery += ` AND p.is_featured = true`;
        }

        if (difficulty) {
            countParamCount++;
            countQuery += ` AND p.difficulty_level = $${countParamCount}`;
            countParams.push(difficulty);
        }

        if (trending === 'true') {
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
            countQuery += ` AND p.created_at > '${oneWeekAgo}' AND p.usage_count > 10`;
        }

        const { rows: countResult } = await sql.query(countQuery, countParams);
        const total = parseInt(countResult[0].total);

        return res.status(200).json({
            prompts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error fetching prompts:', error);
        return res.status(500).json({ error: 'Failed to fetch prompts' });
    }
}

// POST /api/prompts - Create a new prompt
async function handlePost(req, res) {
    // Validate input
    const { error, value } = createPromptSchema.validate(req.body);
    if (error) {
        return res.status(400).json({
            error: 'Validation failed',
            message: 'Please check your input',
            details: error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }))
        });
    }

    const {
        title,
        content,
        description,
        category,
        tags = [],
        difficulty_level = 'intermediate',
        is_public = true
    } = value;

    try {
        // For now, use a default author (in real app, get from auth)
        const authorId = '00000000-0000-0000-0000-000000000000'; // Default system user

        const { rows } = await sql.query(`
            INSERT INTO prompts (
                title, content, description, category, tags, 
                difficulty_level, author_id, is_public, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
            RETURNING *
        `, [title, content, description, category, tags, difficulty_level, authorId, is_public]);

        return res.status(201).json({
            prompt: rows[0],
            message: 'Prompt created successfully'
        });

    } catch (error) {
        console.error('Error creating prompt:', error);
        return res.status(500).json({ error: 'Failed to create prompt' });
    }
}

// PUT /api/prompts - Update a prompt
async function handlePut(req, res) {
    const { id } = req.query;
    const {
        title,
        content,
        description,
        category,
        tags,
        difficulty_level,
        is_public
    } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'Prompt ID is required' });
    }

    try {
        // Check if prompt exists
        const { rows: existing } = await sql.query(
            'SELECT * FROM prompts WHERE id = $1',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Prompt not found' });
        }

        // Build update query dynamically
        const updates = [];
        const params = [];
        let paramCount = 0;

        if (title !== undefined) {
            paramCount++;
            updates.push(`title = $${paramCount}`);
            params.push(title);
        }

        if (content !== undefined) {
            paramCount++;
            updates.push(`content = $${paramCount}`);
            params.push(content);
        }

        if (description !== undefined) {
            paramCount++;
            updates.push(`description = $${paramCount}`);
            params.push(description);
        }

        if (category !== undefined) {
            paramCount++;
            updates.push(`category = $${paramCount}`);
            params.push(category);
        }

        if (tags !== undefined) {
            paramCount++;
            updates.push(`tags = $${paramCount}`);
            params.push(tags);
        }

        if (difficulty_level !== undefined) {
            paramCount++;
            updates.push(`difficulty_level = $${paramCount}`);
            params.push(difficulty_level);
        }

        if (is_public !== undefined) {
            paramCount++;
            updates.push(`is_public = $${paramCount}`);
            params.push(is_public);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        paramCount++;
        updates.push(`updated_at = NOW()`);
        params.push(id);

        const query = `
            UPDATE prompts 
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;

        const { rows } = await sql.query(query, params);

        return res.status(200).json({
            prompt: rows[0],
            message: 'Prompt updated successfully'
        });

    } catch (error) {
        console.error('Error updating prompt:', error);
        return res.status(500).json({ error: 'Failed to update prompt' });
    }
}

// DELETE /api/prompts - Delete a prompt
async function handleDelete(req, res) {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'Prompt ID is required' });
    }

    try {
        // Check if prompt exists
        const { rows: existing } = await sql.query(
            'SELECT * FROM prompts WHERE id = $1',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Prompt not found' });
        }

        // Delete the prompt (cascade will handle related records)
        await sql.query('DELETE FROM prompts WHERE id = $1', [id]);

        return res.status(200).json({
            message: 'Prompt deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting prompt:', error);
        return res.status(500).json({ error: 'Failed to delete prompt' });
    }
}
