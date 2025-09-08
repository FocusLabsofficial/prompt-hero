// API endpoint for favorites management
import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        switch (req.method) {
            case 'GET':
                return await handleGet(req, res);
            case 'POST':
                return await handlePost(req, res);
            case 'DELETE':
                return await handleDelete(req, res);
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

// GET /api/favorites - Get user's favorite prompts
async function handleGet(req, res) {
    const { user_id, page = 1, limit = 20 } = req.query;

    if (!user_id) {
        return res.status(400).json({ error: 'User ID is required' });
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const { rows } = await sql.query(`
            SELECT 
                p.*,
                u.username as author_username,
                u.display_name as author_display_name,
                u.avatar_url as author_avatar_url,
                f.created_at as favorited_at,
                COUNT(DISTINCT r.id) as total_ratings,
                COUNT(DISTINCT f2.user_id) as total_favorites
            FROM favorites f
            JOIN prompts p ON f.prompt_id = p.id
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN ratings r ON p.id = r.prompt_id
            LEFT JOIN favorites f2 ON p.id = f2.prompt_id
            WHERE f.user_id = $1 AND p.is_public = true
            GROUP BY p.id, u.username, u.display_name, u.avatar_url, f.created_at
            ORDER BY f.created_at DESC
            LIMIT $2 OFFSET $3
        `, [user_id, parseInt(limit), offset]);

        // Get total count
        const { rows: countResult } = await sql.query(`
            SELECT COUNT(*) as total
            FROM favorites f
            JOIN prompts p ON f.prompt_id = p.id
            WHERE f.user_id = $1 AND p.is_public = true
        `, [user_id]);

        const total = parseInt(countResult[0].total);

        return res.status(200).json({
            favorites: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error fetching favorites:', error);
        return res.status(500).json({ error: 'Failed to fetch favorites' });
    }
}

// POST /api/favorites - Add a prompt to favorites
async function handlePost(req, res) {
    const { user_id, prompt_id } = req.body;

    if (!user_id || !prompt_id) {
        return res.status(400).json({ error: 'User ID and Prompt ID are required' });
    }

    try {
        // Check if prompt exists and is public
        const { rows: prompt } = await sql.query(
            'SELECT * FROM prompts WHERE id = $1 AND is_public = true',
            [prompt_id]
        );

        if (prompt.length === 0) {
            return res.status(404).json({ error: 'Prompt not found' });
        }

        // Check if already favorited
        const { rows: existing } = await sql.query(
            'SELECT * FROM favorites WHERE user_id = $1 AND prompt_id = $2',
            [user_id, prompt_id]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Prompt already in favorites' });
        }

        // Add to favorites
        const { rows } = await sql.query(`
            INSERT INTO favorites (user_id, prompt_id, created_at)
            VALUES ($1, $2, NOW())
            RETURNING *
        `, [user_id, prompt_id]);

        return res.status(201).json({
            favorite: rows[0],
            message: 'Prompt added to favorites'
        });

    } catch (error) {
        console.error('Error adding favorite:', error);
        return res.status(500).json({ error: 'Failed to add favorite' });
    }
}

// DELETE /api/favorites - Remove a prompt from favorites
async function handleDelete(req, res) {
    const { user_id, prompt_id } = req.query;

    if (!user_id || !prompt_id) {
        return res.status(400).json({ error: 'User ID and Prompt ID are required' });
    }

    try {
        // Check if favorite exists
        const { rows: existing } = await sql.query(
            'SELECT * FROM favorites WHERE user_id = $1 AND prompt_id = $2',
            [user_id, prompt_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Favorite not found' });
        }

        // Remove from favorites
        await sql.query(
            'DELETE FROM favorites WHERE user_id = $1 AND prompt_id = $2',
            [user_id, prompt_id]
        );

        return res.status(200).json({
            message: 'Prompt removed from favorites'
        });

    } catch (error) {
        console.error('Error removing favorite:', error);
        return res.status(500).json({ error: 'Failed to remove favorite' });
    }
}
