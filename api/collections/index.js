// API endpoint for collections management
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
        console.error('API Error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
        });
    }
}

// GET /api/collections - List collections
async function handleGet(req, res) {
    const { 
        user_id, 
        page = 1, 
        limit = 20, 
        public_only = 'true',
        sort = 'created_at',
        order = 'desc'
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        let query = `
            SELECT 
                c.*,
                u.username as owner_username,
                u.display_name as owner_display_name,
                u.avatar_url as owner_avatar_url,
                COUNT(DISTINCT cp.prompt_id) as total_prompts,
                COUNT(DISTINCT f.user_id) as total_followers
            FROM collections c
            LEFT JOIN users u ON c.owner_id = u.id
            LEFT JOIN collection_prompts cp ON c.id = cp.collection_id
            LEFT JOIN favorites f ON c.id = f.collection_id
            WHERE 1=1
        `;
        
        const params = [];
        let paramCount = 0;

        // Filter by user if specified
        if (user_id) {
            paramCount++;
            query += ` AND c.owner_id = $${paramCount}`;
            params.push(user_id);
        }

        // Filter by public/private
        if (public_only === 'true') {
            query += ` AND c.is_public = true`;
        }

        // Group by collection fields
        query += ` GROUP BY c.id, u.username, u.display_name, u.avatar_url`;

        // Add sorting
        const validSortFields = ['created_at', 'name', 'total_prompts', 'total_followers'];
        const sortField = validSortFields.includes(sort) ? sort : 'created_at';
        const sortOrder = order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
        
        query += ` ORDER BY c.${sortField} ${sortOrder}`;

        // Add pagination
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(parseInt(limit));
        
        paramCount++;
        query += ` OFFSET $${paramCount}`;
        params.push(offset);

        const { rows: collections } = await sql.query(query, params);

        // Get total count
        let countQuery = `SELECT COUNT(DISTINCT c.id) as total FROM collections c WHERE 1=1`;
        const countParams = [];
        let countParamCount = 0;

        if (user_id) {
            countParamCount++;
            countQuery += ` AND c.owner_id = $${countParamCount}`;
            countParams.push(user_id);
        }

        if (public_only === 'true') {
            countQuery += ` AND c.is_public = true`;
        }

        const { rows: countResult } = await sql.query(countQuery, countParams);
        const total = parseInt(countResult[0].total);

        return res.status(200).json({
            collections,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Error fetching collections:', error);
        return res.status(500).json({ error: 'Failed to fetch collections' });
    }
}

// POST /api/collections - Create a new collection
async function handlePost(req, res) {
    const {
        name,
        description,
        is_public = true,
        owner_id
    } = req.body;

    // Validation
    if (!name || !owner_id) {
        return res.status(400).json({ error: 'Name and owner ID are required' });
    }

    if (name.length > 255) {
        return res.status(400).json({ error: 'Name too long (max 255 characters)' });
    }

    try {
        const { rows } = await sql.query(`
            INSERT INTO collections (name, description, is_public, owner_id, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING *
        `, [name, description, is_public, owner_id]);

        return res.status(201).json({
            collection: rows[0],
            message: 'Collection created successfully'
        });

    } catch (error) {
        console.error('Error creating collection:', error);
        return res.status(500).json({ error: 'Failed to create collection' });
    }
}

// PUT /api/collections - Update a collection
async function handlePut(req, res) {
    const { id } = req.query;
    const {
        name,
        description,
        is_public
    } = req.body;

    if (!id) {
        return res.status(400).json({ error: 'Collection ID is required' });
    }

    try {
        // Check if collection exists
        const { rows: existing } = await sql.query(
            'SELECT * FROM collections WHERE id = $1',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Build update query dynamically
        const updates = [];
        const params = [];
        let paramCount = 0;

        if (name !== undefined) {
            paramCount++;
            updates.push(`name = $${paramCount}`);
            params.push(name);
        }

        if (description !== undefined) {
            paramCount++;
            updates.push(`description = $${paramCount}`);
            params.push(description);
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
        params.push(id);

        const query = `
            UPDATE collections 
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;

        const { rows } = await sql.query(query, params);

        return res.status(200).json({
            collection: rows[0],
            message: 'Collection updated successfully'
        });

    } catch (error) {
        console.error('Error updating collection:', error);
        return res.status(500).json({ error: 'Failed to update collection' });
    }
}

// DELETE /api/collections - Delete a collection
async function handleDelete(req, res) {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: 'Collection ID is required' });
    }

    try {
        // Check if collection exists
        const { rows: existing } = await sql.query(
            'SELECT * FROM collections WHERE id = $1',
            [id]
        );

        if (existing.length === 0) {
            return res.status(404).json({ error: 'Collection not found' });
        }

        // Delete the collection (cascade will handle related records)
        await sql.query('DELETE FROM collections WHERE id = $1', [id]);

        return res.status(200).json({
            message: 'Collection deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting collection:', error);
        return res.status(500).json({ error: 'Failed to delete collection' });
    }
}
