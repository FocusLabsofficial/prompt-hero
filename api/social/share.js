import { sql } from '@vercel/postgres';
import { securityHeaders, rateLimit, requestLogger, errorHandler } from '../middleware/security.js';

export default async function handler(req, res) {
  // Apply security middleware
  securityHeaders(req, res, () => {});
  requestLogger(req, res, () => {});
  
  if (req.method === 'POST') {
    return handleShare(req, res);
  } else if (req.method === 'GET') {
    return handleGetShares(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleShare(req, res) {
  try {
    // Rate limiting
    await new Promise((resolve, reject) => {
      rateLimit(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Check authentication
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const currentUser = await verifyToken(token);
    if (!currentUser) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { 
      content_type, 
      content_id, 
      share_platform, 
      message,
      is_public = true 
    } = req.body;

    // Validate required fields
    if (!content_type || !content_id || !share_platform) {
      return res.status(400).json({ 
        error: 'content_type, content_id, and share_platform are required' 
      });
    }

    // Validate content type
    const validContentTypes = ['prompt', 'collection'];
    if (!validContentTypes.includes(content_type)) {
      return res.status(400).json({ 
        error: 'content_type must be either "prompt" or "collection"' 
      });
    }

    // Validate share platform
    const validPlatforms = ['twitter', 'linkedin', 'facebook', 'reddit', 'email', 'link'];
    if (!validPlatforms.includes(share_platform)) {
      return res.status(400).json({ 
        error: 'Invalid share platform' 
      });
    }

    // Check if content exists and is accessible
    let contentExists = false;
    if (content_type === 'prompt') {
      const promptCheck = await sql`
        SELECT id FROM prompts 
        WHERE id = ${content_id} AND is_public = true
      `;
      contentExists = promptCheck.rows.length > 0;
    } else if (content_type === 'collection') {
      const collectionCheck = await sql`
        SELECT id FROM collections 
        WHERE id = ${content_id} AND (is_public = true OR user_id = ${currentUser.userId})
      `;
      contentExists = collectionCheck.rows.length > 0;
    }

    if (!contentExists) {
      return res.status(404).json({ error: 'Content not found or not accessible' });
    }

    // Create share record
    const shareResult = await sql`
      INSERT INTO shares (
        user_id, content_type, content_id, share_platform, 
        message, is_public, created_at
      )
      VALUES (
        ${currentUser.userId}, ${content_type}, ${content_id}, 
        ${share_platform}, ${message || ''}, ${is_public}, NOW()
      )
      RETURNING id, created_at
    `;

    // Update share count for the content
    if (content_type === 'prompt') {
      await sql`
        UPDATE prompts 
        SET share_count = share_count + 1
        WHERE id = ${content_id}
      `;
    } else if (content_type === 'collection') {
      await sql`
        UPDATE collections 
        SET share_count = share_count + 1
        WHERE id = ${content_id}
      `;
    }

    // Generate share URL
    const shareUrl = generateShareUrl(content_type, content_id, share_platform);

    res.status(201).json({
      message: 'Content shared successfully',
      share: {
        id: shareResult.rows[0].id,
        content_type,
        content_id,
        share_platform,
        message,
        share_url: shareUrl,
        created_at: shareResult.rows[0].created_at
      }
    });

  } catch (error) {
    console.error('Share error:', error);
    errorHandler(error, req, res, () => {});
  }
}

async function handleGetShares(req, res) {
  try {
    // Rate limiting
    await new Promise((resolve, reject) => {
      rateLimit(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const { 
      content_type, 
      content_id, 
      user_id,
      page = 1, 
      limit = 20 
    } = req.query;

    const offset = (page - 1) * limit;

    // Build query conditions
    let whereConditions = ['s.is_public = true'];
    let queryParams = [];
    let paramIndex = 1;

    if (content_type && content_id) {
      whereConditions.push(`s.content_type = $${paramIndex}`);
      queryParams.push(content_type);
      paramIndex++;
      
      whereConditions.push(`s.content_id = $${paramIndex}`);
      queryParams.push(content_id);
      paramIndex++;
    }

    if (user_id) {
      whereConditions.push(`s.user_id = $${paramIndex}`);
      queryParams.push(user_id);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get shares with user information
    const sharesQuery = `
      SELECT 
        s.id,
        s.content_type,
        s.content_id,
        s.share_platform,
        s.message,
        s.created_at,
        u.username,
        up.display_name,
        up.avatar_url
      FROM shares s
      LEFT JOIN users u ON s.user_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);
    const sharesResult = await sql.unsafe(sharesQuery, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM shares s
      WHERE ${whereClause}
    `;

    const countResult = await sql.unsafe(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      shares: sharesResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        total_pages: totalPages,
        has_next_page: hasNextPage,
        has_prev_page: hasPrevPage
      }
    });

  } catch (error) {
    console.error('Get shares error:', error);
    errorHandler(error, req, res, () => {});
  }
}

function generateShareUrl(contentType, contentId, platform) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://prompthero.com';
  
  let url = '';
  if (contentType === 'prompt') {
    url = `${baseUrl}/prompt/${contentId}`;
  } else if (contentType === 'collection') {
    url = `${baseUrl}/collection/${contentId}`;
  }

  // Generate platform-specific share URLs
  const shareUrls = {
    twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=Check out this ${contentType} on Prompt Hero!`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    reddit: `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=Check out this ${contentType} on Prompt Hero!`,
    email: `mailto:?subject=Check out this ${contentType} on Prompt Hero!&body=${encodeURIComponent(url)}`,
    link: url
  };

  return shareUrls[platform] || url;
}

async function verifyToken(token) {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    
    // Check if token is expired
    if (Date.now() > decoded.expires) {
      return null;
    }
    
    return decoded;
  } catch (error) {
    return null;
  }
}
