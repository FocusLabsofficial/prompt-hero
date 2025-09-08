// API endpoint for individual prompt operations
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'Prompt ID is required' });
    }

    try {
        switch (req.method) {
            case 'GET':
                return await handleGet(req, res, id);
            case 'POST':
                return await handlePost(req, res, id);
            case 'PUT':
                return await handlePut(req, res, id);
            case 'DELETE':
                return await handleDelete(req, res, id);
            default:
                return res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
}

// GET /api/prompts/[id] - Get a specific prompt with details
async function handleGet(req, res, id) {
    try {
        const { rows } = await sql.query(`
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
            WHERE p.id = $1 AND p.is_public = true
            GROUP BY p.id, u.username, u.display_name, u.avatar_url
        `, [id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Prompt not found' });
        }

        // Get ratings for this prompt
        const { rows: ratings } = await sql.query(`
            SELECT 
                r.*,
                u.username,
                u.display_name,
                u.avatar_url
            FROM ratings r
            LEFT JOIN users u ON r.user_id = u.id
            WHERE r.prompt_id = $1
            ORDER BY r.created_at DESC
            LIMIT 10
        `, [id]);

        // Get related prompts (same category, excluding current)
        const { rows: related } = await sql.query(`
            SELECT 
                p.id,
                p.title,
                p.description,
                p.category,
                p.average_rating,
                p.total_ratings,
                u.username as author_username
            FROM prompts p
            LEFT JOIN users u ON p.author_id = u.id
            WHERE p.category = $1 AND p.id != $2 AND p.is_public = true
            ORDER BY p.average_rating DESC, p.total_ratings DESC
            LIMIT 5
        `, [rows[0].category, id]);

        return res.status(200).json({
            prompt: rows[0],
            ratings,
            related
        });

    } catch (error) {
        console.error('Error fetching prompt:', error);
        return res.status(500).json({ error: 'Failed to fetch prompt' });
    }
}

// POST /api/prompts/[id] - Rate a prompt
async function handlePost(req, res, id) {
    const { rating, review, user_id } = req.body;

    // Validation
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    if (!user_id) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    try {
        // Check if prompt exists
        const { rows: prompt } = await sql.query(
            'SELECT * FROM prompts WHERE id = $1 AND is_public = true',
            [id]
        );

        if (prompt.length === 0) {
            return res.status(404).json({ error: 'Prompt not found' });
        }

        // Check if user already rated this prompt
        const { rows: existingRating } = await sql.query(
            'SELECT * FROM ratings WHERE prompt_id = $1 AND user_id = $2',
            [id, user_id]
        );

        if (existingRating.length > 0) {
            // Update existing rating
            const { rows } = await sql.query(`
                UPDATE ratings 
                SET rating = $1, review = $2, created_at = NOW()
                WHERE prompt_id = $3 AND user_id = $4
                RETURNING *
            `, [rating, review, id, user_id]);

            return res.status(200).json({
                rating: rows[0],
                message: 'Rating updated successfully'
            });
        } else {
            // Create new rating
            const { rows } = await sql.query(`
                INSERT INTO ratings (prompt_id, user_id, rating, review, created_at)
                VALUES ($1, $2, $3, $4, NOW())
                RETURNING *
            `, [id, user_id, rating, review]);

            return res.status(201).json({
                rating: rows[0],
                message: 'Rating created successfully'
            });
        }

    } catch (error) {
        console.error('Error rating prompt:', error);
        return res.status(500).json({ error: 'Failed to rate prompt' });
    }
}

// PUT /api/prompts/[id] - Update prompt usage count
async function handlePut(req, res, id) {
    const { action } = req.body;

    try {
        // Check if prompt exists
        const { rows: prompt } = await sql.query(
            'SELECT * FROM prompts WHERE id = $1 AND is_public = true',
            [id]
        );

        if (prompt.length === 0) {
            return res.status(404).json({ error: 'Prompt not found' });
        }

        if (action === 'increment_usage') {
            // Increment usage count
            const { rows } = await sql.query(`
                UPDATE prompts 
                SET usage_count = usage_count + 1, updated_at = NOW()
                WHERE id = $1
                RETURNING usage_count
            `, [id]);

            return res.status(200).json({
                usage_count: rows[0].usage_count,
                message: 'Usage count incremented'
            });
        } else if (action === 'increment_view') {
            // Increment view count
            const { rows } = await sql.query(`
                UPDATE prompts 
                SET view_count = view_count + 1, updated_at = NOW()
                WHERE id = $1
                RETURNING view_count
            `, [id]);

            return res.status(200).json({
                view_count: rows[0].view_count,
                message: 'View count incremented'
            });
        } else {
            return res.status(400).json({ error: 'Invalid action' });
        }

    } catch (error) {
        console.error('Error updating prompt:', error);
        return res.status(500).json({ error: 'Failed to update prompt' });
    }
}

// DELETE /api/prompts/[id] - Delete a prompt
async function handleDelete(req, res, id) {
    try {
        // Check if prompt exists
        const { rows: prompt } = await sql.query(
            'SELECT * FROM prompts WHERE id = $1',
            [id]
        );

        if (prompt.length === 0) {
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
