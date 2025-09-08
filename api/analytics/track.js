import { sql } from '@vercel/postgres';
import { securityHeaders, rateLimit, requestLogger, errorHandler } from '../middleware/security.js';

export default async function handler(req, res) {
  // Apply security middleware
  securityHeaders(req, res, () => {});
  requestLogger(req, res, () => {});
  
  if (req.method === 'POST') {
    return handleTrack(req, res);
  } else if (req.method === 'GET') {
    return handleGetAnalytics(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleTrack(req, res) {
  try {
    // Rate limiting
    await new Promise((resolve, reject) => {
      rateLimit(req, res, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const { 
      event_type,
      content_type,
      content_id,
      user_id,
      session_id,
      metadata = {}
    } = req.body;

    // Validate required fields
    if (!event_type) {
      return res.status(400).json({ error: 'event_type is required' });
    }

    // Validate event type
    const validEventTypes = [
      'page_view',
      'prompt_view',
      'prompt_copy',
      'prompt_favorite',
      'prompt_unfavorite',
      'prompt_rating',
      'prompt_share',
      'collection_view',
      'collection_follow',
      'collection_unfollow',
      'user_follow',
      'user_unfollow',
      'search',
      'filter_apply',
      'signup',
      'login',
      'logout'
    ];

    if (!validEventTypes.includes(event_type)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    // Get user agent and IP for analytics
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    const referer = req.headers.referer || '';

    // Create analytics record
    const analyticsResult = await sql`
      INSERT INTO analytics_events (
        event_type, content_type, content_id, user_id, session_id,
        user_agent, ip_address, referer, metadata, created_at
      )
      VALUES (
        ${event_type}, ${content_type || null}, ${content_id || null}, 
        ${user_id || null}, ${session_id || null}, ${userAgent}, 
        ${ip}, ${referer}, ${JSON.stringify(metadata)}, NOW()
      )
      RETURNING id
    `;

    // Update relevant counters based on event type
    await updateCounters(event_type, content_type, content_id, user_id);

    res.status(201).json({
      message: 'Event tracked successfully',
      event_id: analyticsResult.rows[0].id
    });

  } catch (error) {
    console.error('Analytics tracking error:', error);
    errorHandler(error, req, res, () => {});
  }
}

async function handleGetAnalytics(req, res) {
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

    // Check if user is admin or moderator
    const userCheck = await sql`
      SELECT is_admin, is_moderator FROM users WHERE id = ${currentUser.userId}
    `;

    if (userCheck.rows.length === 0 || (!userCheck.rows[0].is_admin && !userCheck.rows[0].is_moderator)) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { 
      start_date,
      end_date,
      event_type,
      content_type,
      group_by = 'day',
      limit = 100
    } = req.query;

    // Build query conditions
    let whereConditions = ['1=1'];
    let queryParams = [];
    let paramIndex = 1;

    if (start_date) {
      whereConditions.push(`created_at >= $${paramIndex}`);
      queryParams.push(start_date);
      paramIndex++;
    }

    if (end_date) {
      whereConditions.push(`created_at <= $${paramIndex}`);
      queryParams.push(end_date);
      paramIndex++;
    }

    if (event_type) {
      whereConditions.push(`event_type = $${paramIndex}`);
      queryParams.push(event_type);
      paramIndex++;
    }

    if (content_type) {
      whereConditions.push(`content_type = $${paramIndex}`);
      queryParams.push(content_type);
      paramIndex++;
    }

    const whereClause = whereConditions.join(' AND ');

    // Get analytics data
    let analyticsQuery;
    if (group_by === 'day') {
      analyticsQuery = `
        SELECT 
          DATE(created_at) as date,
          event_type,
          COUNT(*) as event_count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM analytics_events
        WHERE ${whereClause}
        GROUP BY DATE(created_at), event_type
        ORDER BY date DESC, event_type
        LIMIT $${paramIndex}
      `;
    } else if (group_by === 'hour') {
      analyticsQuery = `
        SELECT 
          DATE_TRUNC('hour', created_at) as hour,
          event_type,
          COUNT(*) as event_count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM analytics_events
        WHERE ${whereClause}
        GROUP BY DATE_TRUNC('hour', created_at), event_type
        ORDER BY hour DESC, event_type
        LIMIT $${paramIndex}
      `;
    } else {
      analyticsQuery = `
        SELECT 
          event_type,
          content_type,
          COUNT(*) as event_count,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM analytics_events
        WHERE ${whereClause}
        GROUP BY event_type, content_type
        ORDER BY event_count DESC
        LIMIT $${paramIndex}
      `;
    }

    queryParams.push(limit);
    const analyticsResult = await sql.unsafe(analyticsQuery, queryParams);

    // Get top content
    const topContentQuery = `
      SELECT 
        content_type,
        content_id,
        COUNT(*) as view_count
      FROM analytics_events
      WHERE ${whereClause}
        AND event_type IN ('prompt_view', 'collection_view')
        AND content_id IS NOT NULL
      GROUP BY content_type, content_id
      ORDER BY view_count DESC
      LIMIT 10
    `;

    const topContentResult = await sql.unsafe(topContentQuery, queryParams.slice(0, -1));

    // Get user engagement metrics
    const engagementQuery = `
      SELECT 
        COUNT(DISTINCT user_id) as total_users,
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(*) as total_events,
        AVG(CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END) as authenticated_ratio
      FROM analytics_events
      WHERE ${whereClause}
    `;

    const engagementResult = await sql.unsafe(engagementQuery, queryParams.slice(0, -1));

    res.status(200).json({
      analytics: analyticsResult.rows,
      top_content: topContentResult.rows,
      engagement: engagementResult.rows[0],
      filters: {
        start_date,
        end_date,
        event_type,
        content_type,
        group_by
      }
    });

  } catch (error) {
    console.error('Get analytics error:', error);
    errorHandler(error, req, res, () => {});
  }
}

async function updateCounters(eventType, contentType, contentId, userId) {
  try {
    switch (eventType) {
      case 'prompt_view':
        if (contentId) {
          await sql`
            UPDATE prompts 
            SET view_count = view_count + 1
            WHERE id = ${contentId}
          `;
        }
        break;

      case 'prompt_copy':
        if (contentId) {
          await sql`
            UPDATE prompts 
            SET usage_count = usage_count + 1
            WHERE id = ${contentId}
          `;
        }
        break;

      case 'prompt_favorite':
        if (contentId) {
          await sql`
            UPDATE prompts 
            SET total_favorites = total_favorites + 1
            WHERE id = ${contentId}
          `;
        }
        break;

      case 'prompt_unfavorite':
        if (contentId) {
          await sql`
            UPDATE prompts 
            SET total_favorites = GREATEST(total_favorites - 1, 0)
            WHERE id = ${contentId}
          `;
        }
        break;

      case 'prompt_share':
        if (contentId) {
          await sql`
            UPDATE prompts 
            SET share_count = share_count + 1
            WHERE id = ${contentId}
          `;
        }
        break;

      case 'collection_view':
        if (contentId) {
          await sql`
            UPDATE collections 
            SET view_count = view_count + 1
            WHERE id = ${contentId}
          `;
        }
        break;

      case 'collection_follow':
        if (contentId) {
          await sql`
            UPDATE collections 
            SET total_followers = total_followers + 1
            WHERE id = ${contentId}
          `;
        }
        break;

      case 'collection_unfollow':
        if (contentId) {
          await sql`
            UPDATE collections 
            SET total_followers = GREATEST(total_followers - 1, 0)
            WHERE id = ${contentId}
          `;
        }
        break;

      case 'user_follow':
        if (userId) {
          await sql`
            UPDATE user_profiles 
            SET followers_count = followers_count + 1
            WHERE user_id = ${userId}
          `;
        }
        break;

      case 'user_unfollow':
        if (userId) {
          await sql`
            UPDATE user_profiles 
            SET followers_count = GREATEST(followers_count - 1, 0)
            WHERE user_id = ${userId}
          `;
        }
        break;
    }
  } catch (error) {
    console.error('Error updating counters:', error);
    // Don't throw error to avoid breaking the main analytics flow
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
