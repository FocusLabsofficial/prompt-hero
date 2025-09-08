// API endpoint for managing prompts in collections
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

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'Collection ID is required' });
    }

    try {
        switch (req.method) {
            case 'GET':
                return await handleGet(req, res, id);
            case 'POST':
                return await handlePost(req, res, id);
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

// GET /api/collections/[id]/prompts - Get prompts in a collection
async function handleGet(req, res, collectionId) {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        // Check if collection exists and is accessible
        const { rows: collection } = await sql.query(`
            SELECT c.*, u.username as owner_username
            FROM collections c
            LEFT JOIN users u ON c.owner_id = u.id
            WHERE c.id = $1 AND c.is_public = true
        `, [collectionId]);

        if (collection.length === 0) {
            return res.status(404).json({ error: 'Collection not found or not public' });
        }

        // Get prompts in the collection
        const { rows: prompts } = await sql.query(`
            SELECT 
                p.*,
                u.username as author_username,
                u.display_name as author_display_name,
                u.avatar_url as author_avatar_url,
                cp.added_at as added_to_collection_at,
                COUNT(DISTINCT r.id) as total_ratings,
                COUNT(DISTINCT f.user_id) as total_favorites
            FROM collection_prompts cp
            JOIN prompts p ON cp.prompt_id = p.id
            LEFT JOIN users u ON p.author_id = u.id
            LEFT JOIN ratings r ON p.id = r.prompt_id
            LEFT JOIN favorites f ON p.id = f.prompt_id
            WHERE cp.collection_id = $1 AND p.is_public = true
            GROUP BY p.id, u.username, u.display_name, u.avatar_url, cp.added_at
            ORDER BY cp.added_at DESC
            LIMIT $2 OFFSET $3
        `, [collectionId, parseInt(limit), offset]);

        // Get total count
        const { rows: countResult } = await sql.query(`
            SELECT COUNT(*) as total
            FROM collection_prompts cp
            JOIN prompts p ON cp.prompt_id = p.id
            WHERE cp.collection_id = $1 AND p.is_public = true
        `, [collectionId]);

        const total = parseInt(countResult[0].total);

        return res.status(200).json({
            collection: collection[0],
            prompts,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error fetching collection prompts:', error);
        return res.status(500).json({ error: 'Failed to fetch collection prompts' });
    }
}

// POST /api/collections/[id]/prompts - Add a prompt to a collection
async function handlePost(req, res, collectionId) {
    const { prompt_id } = req.body;

    if (!prompt_id) {
        return res.status(400).json({ error: 'Prompt ID is required' });
    }

    try {
        // Check if collection exists and is accessible
        const { rows: collection } = await sql.query(
            'SELECT * FROM collections WHERE id = $1',
            [collectionId]
        );

        if (collection.length === 0) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Check if prompt exists and is public
        const { rows: prompt } = await sql.query(
            'SELECT * FROM prompts WHERE id = $1 AND is_public = true',
            [prompt_id]
        );

        if (prompt.length === 0) {
            return res.status(404).json({ error: 'Prompt not found' });
        }

        // Check if prompt is already in collection
        const { rows: existing } = await sql.query(
            'SELECT * FROM collection_prompts WHERE collection_id = $1 AND prompt_id = $2',
            [collectionId, prompt_id]
        );

        if (existing.length > 0) {
            return res.status(409).json({ error: 'Prompt already in collection' });
        }

        // Add prompt to collection
        const { rows } = await sql.query(`
            INSERT INTO collection_prompts (collection_id, prompt_id, added_at)
            VALUES ($1, $2, NOW())
            RETURNING *
        `, [collectionId, prompt_id]);

        return res.status(201).json({
            collection_prompt: rows[0],
            message: 'Prompt added to collection'
        });

    } catch (error) {
        console.error('Error adding prompt to collection:', error);
        return res.status(500).json({ error: 'Failed to add prompt to collection' });
    }
}

// DELETE /api/collections/[id]/prompts - Remove a prompt from a collection
async function handleDelete(req, res, collectionId) {
    const { prompt_id } = req.query;

    if (!prompt_id) {
        return res.status(400).json({ error: 'Prompt ID is required' });
    }

    try {
        // Check if collection exists
        const { rows: collection } = await sql.query(
            'SELECT * FROM collections WHERE id = $1',
            [collectionId]
        );

        if (collection.length === 0) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Check if prompt is in collection
        const { rows: existing } = await sql.query(
            'SELECT * FROM collection_prompts WHERE collection_id = $1 AND prompt_id = $2',
            [collectionId, prompt_id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Prompt not found in collection' });
        }

        // Remove prompt from collection
        await sql.query(
            'DELETE FROM collection_prompts WHERE collection_id = $1 AND prompt_id = $2',
            [collectionId, prompt_id]
        );

        return res.status(200).json({
            message: 'Prompt removed from collection'
        });

    } catch (error) {
        console.error('Error removing prompt from collection:', error);
        return res.status(500).json({ error: 'Failed to remove prompt from collection' });
    }
}
