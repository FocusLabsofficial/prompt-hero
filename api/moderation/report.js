import { sql } from '@vercel/postgres';
import { securityHeaders, rateLimit, requestLogger, errorHandler } from '../middleware/security.js';

export default async function handler(req, res) {
  // Apply security middleware
  securityHeaders(req, res, () => {});
  requestLogger(req, res, () => {});
  
  if (req.method === 'POST') {
    return handleReport(req, res);
  } else if (req.method === 'GET') {
    return handleGetReports(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleReport(req, res) {
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
      reason, 
      description,
      evidence_urls = []
    } = req.body;

    // Validate required fields
    if (!content_type || !content_id || !reason) {
      return res.status(400).json({ 
        error: 'content_type, content_id, and reason are required' 
      });
    }

    // Validate content type
    const validContentTypes = ['prompt', 'collection', 'user', 'comment'];
    if (!validContentTypes.includes(content_type)) {
      return res.status(400).json({ 
        error: 'Invalid content type' 
      });
    }

    // Validate reason
    const validReasons = [
      'spam',
      'inappropriate_content',
      'harassment',
      'hate_speech',
      'violence',
      'copyright_violation',
      'misinformation',
      'fake_content',
      'other'
    ];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ 
        error: 'Invalid reason' 
      });
    }

    // Check if content exists
    let contentExists = false;
    if (content_type === 'prompt') {
      const promptCheck = await sql`
        SELECT id FROM prompts WHERE id = ${content_id}
      `;
      contentExists = promptCheck.rows.length > 0;
    } else if (content_type === 'collection') {
      const collectionCheck = await sql`
        SELECT id FROM collections WHERE id = ${content_id}
      `;
      contentExists = collectionCheck.rows.length > 0;
    } else if (content_type === 'user') {
      const userCheck = await sql`
        SELECT id FROM users WHERE id = ${content_id}
      `;
      contentExists = userCheck.rows.length > 0;
    }

    if (!contentExists) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Check if user has already reported this content
    const existingReport = await sql`
      SELECT id FROM reports 
      WHERE reporter_id = ${currentUser.userId} 
        AND content_type = ${content_type} 
        AND content_id = ${content_id}
    `;

    if (existingReport.rows.length > 0) {
      return res.status(409).json({ error: 'Content already reported by this user' });
    }

    // Create report
    const reportResult = await sql`
      INSERT INTO reports (
        reporter_id, content_type, content_id, reason, 
        description, evidence_urls, status, created_at
      )
      VALUES (
        ${currentUser.userId}, ${content_type}, ${content_id}, 
        ${reason}, ${description || ''}, ${JSON.stringify(evidence_urls)}, 
        'pending', NOW()
      )
      RETURNING id, created_at
    `;

    // Update report count for the content
    if (content_type === 'prompt') {
      await sql`
        UPDATE prompts 
        SET report_count = report_count + 1
        WHERE id = ${content_id}
      `;
    } else if (content_type === 'collection') {
      await sql`
        UPDATE collections 
        SET report_count = report_count + 1
        WHERE id = ${content_id}
      `;
    }

    // Check if content should be automatically flagged
    const reportCount = await sql`
      SELECT COUNT(*) as count FROM reports 
      WHERE content_type = ${content_type} AND content_id = ${content_id}
    `;

    const totalReports = parseInt(reportCount.rows[0].count);

    // Auto-flag content if it has 3 or more reports
    if (totalReports >= 3) {
      await sql`
        UPDATE reports 
        SET status = 'flagged', updated_at = NOW()
        WHERE content_type = ${content_type} AND content_id = ${content_id}
      `;

      // Hide content if it has 5 or more reports
      if (totalReports >= 5) {
        if (content_type === 'prompt') {
          await sql`
            UPDATE prompts 
            SET is_public = false, moderation_status = 'hidden'
            WHERE id = ${content_id}
          `;
        } else if (content_type === 'collection') {
          await sql`
            UPDATE collections 
            SET is_public = false, moderation_status = 'hidden'
            WHERE id = ${content_id}
          `;
        }
      }
    }

    res.status(201).json({
      message: 'Report submitted successfully',
      report: {
        id: reportResult.rows[0].id,
        content_type,
        content_id,
        reason,
        status: totalReports >= 3 ? 'flagged' : 'pending',
        created_at: reportResult.rows[0].created_at
      }
    });

  } catch (error) {
    console.error('Report error:', error);
    errorHandler(error, req, res, () => {});
  }
}

async function handleGetReports(req, res) {
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

    // Check if user is a moderator
    const userCheck = await sql`
      SELECT is_moderator FROM users WHERE id = ${currentUser.userId}
    `;

    if (userCheck.rows.length === 0 || !userCheck.rows[0].is_moderator) {
      return res.status(403).json({ error: 'Moderator access required' });
    }

    const { 
      status = 'pending',
      content_type,
      page = 1, 
      limit = 20 
    } = req.query;

    const offset = (page - 1) * limit;

    // Build query conditions
    let whereConditions = ['1=1'];
    let queryParams = [currentUser.userId];
    let paramIndex = 2;

    if (status) {
      whereConditions.push(`r.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    if (content_type) {
      whereConditions.push(`r.content_type = $${paramIndex}`);
      queryParams.push(content_type);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get reports with content and reporter information
    const reportsQuery = `
      SELECT 
        r.id,
        r.content_type,
        r.content_id,
        r.reason,
        r.description,
        r.evidence_urls,
        r.status,
        r.created_at,
        r.updated_at,
        u.username as reporter_username,
        up.display_name as reporter_display_name,
        CASE 
          WHEN r.content_type = 'prompt' THEN p.title
          WHEN r.content_type = 'collection' THEN c.name
          WHEN r.content_type = 'user' THEN u2.username
          ELSE NULL
        END as content_title
      FROM reports r
      LEFT JOIN users u ON r.reporter_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN prompts p ON r.content_type = 'prompt' AND r.content_id = p.id
      LEFT JOIN collections c ON r.content_type = 'collection' AND r.content_id = c.id
      LEFT JOIN users u2 ON r.content_type = 'user' AND r.content_id = u2.id
      WHERE ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);
    const reportsResult = await sql.unsafe(reportsQuery, queryParams);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM reports r
      WHERE ${whereClause}
    `;

    const countResult = await sql.unsafe(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      reports: reportsResult.rows,
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
    console.error('Get reports error:', error);
    errorHandler(error, req, res, () => {});
  }
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
