import { sql } from '@vercel/postgres';
import { securityHeaders, rateLimit, requestLogger, errorHandler } from '../middleware/security.js';

export default async function handler(req, res) {
  // Apply security middleware
  securityHeaders(req, res, () => {});
  requestLogger(req, res, () => {});
  
  if (req.method === 'POST') {
    return handleModerationAction(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleModerationAction(req, res) {
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
      report_id,
      action,
      reason,
      content_type,
      content_id
    } = req.body;

    // Validate required fields
    if (!report_id || !action) {
      return res.status(400).json({ 
        error: 'report_id and action are required' 
      });
    }

    // Validate action
    const validActions = [
      'approve',
      'reject',
      'warn_user',
      'hide_content',
      'delete_content',
      'suspend_user',
      'ban_user'
    ];
    if (!validActions.includes(action)) {
      return res.status(400).json({ 
        error: 'Invalid moderation action' 
      });
    }

    // Get report details
    const reportResult = await sql`
      SELECT * FROM reports WHERE id = ${report_id}
    `;

    if (reportResult.rows.length === 0) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const report = reportResult.rows[0];

    // Perform moderation action
    let actionResult;
    switch (action) {
      case 'approve':
        actionResult = await approveReport(report_id, currentUser.userId, reason);
        break;
      case 'reject':
        actionResult = await rejectReport(report_id, currentUser.userId, reason);
        break;
      case 'warn_user':
        actionResult = await warnUser(report, currentUser.userId, reason);
        break;
      case 'hide_content':
        actionResult = await hideContent(report, currentUser.userId, reason);
        break;
      case 'delete_content':
        actionResult = await deleteContent(report, currentUser.userId, reason);
        break;
      case 'suspend_user':
        actionResult = await suspendUser(report, currentUser.userId, reason);
        break;
      case 'ban_user':
        actionResult = await banUser(report, currentUser.userId, reason);
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    // Log moderation action
    await sql`
      INSERT INTO moderation_actions (
        moderator_id, report_id, action, reason, 
        content_type, content_id, created_at
      )
      VALUES (
        ${currentUser.userId}, ${report_id}, ${action}, 
        ${reason || ''}, ${report.content_type}, ${report.content_id}, NOW()
      )
    `;

    res.status(200).json({
      message: 'Moderation action completed successfully',
      action: {
        report_id,
        action,
        reason,
        result: actionResult
      }
    });

  } catch (error) {
    console.error('Moderation action error:', error);
    errorHandler(error, req, res, () => {});
  }
}

async function approveReport(reportId, moderatorId, reason) {
  // Mark report as approved
  await sql`
    UPDATE reports 
    SET status = 'approved', moderator_id = ${moderatorId}, 
        moderation_reason = ${reason || ''}, updated_at = NOW()
    WHERE id = ${reportId}
  `;

  return { status: 'approved' };
}

async function rejectReport(reportId, moderatorId, reason) {
  // Mark report as rejected
  await sql`
    UPDATE reports 
    SET status = 'rejected', moderator_id = ${moderatorId}, 
        moderation_reason = ${reason || ''}, updated_at = NOW()
    WHERE id = ${reportId}
  `;

  return { status: 'rejected' };
}

async function warnUser(report, moderatorId, reason) {
  // Get content author
  let authorId;
  if (report.content_type === 'prompt') {
    const promptResult = await sql`
      SELECT author_id FROM prompts WHERE id = ${report.content_id}
    `;
    authorId = promptResult.rows[0]?.author_id;
  } else if (report.content_type === 'collection') {
    const collectionResult = await sql`
      SELECT user_id FROM collections WHERE id = ${report.content_id}
    `;
    authorId = collectionResult.rows[0]?.user_id;
  } else if (report.content_type === 'user') {
    authorId = report.content_id;
  }

  if (authorId) {
    // Create warning
    await sql`
      INSERT INTO user_warnings (
        user_id, moderator_id, reason, content_type, 
        content_id, created_at
      )
      VALUES (
        ${authorId}, ${moderatorId}, ${reason || 'Content policy violation'}, 
        ${report.content_type}, ${report.content_id}, NOW()
      )
    `;

    // Update user warning count
    await sql`
      UPDATE users 
      SET warning_count = warning_count + 1
      WHERE id = ${authorId}
    `;
  }

  return { action: 'warned', user_id: authorId };
}

async function hideContent(report, moderatorId, reason) {
  if (report.content_type === 'prompt') {
    await sql`
      UPDATE prompts 
      SET is_public = false, moderation_status = 'hidden'
      WHERE id = ${report.content_id}
    `;
  } else if (report.content_type === 'collection') {
    await sql`
      UPDATE collections 
      SET is_public = false, moderation_status = 'hidden'
      WHERE id = ${report.content_id}
    `;
  }

  // Update report status
  await sql`
    UPDATE reports 
    SET status = 'action_taken', moderator_id = ${moderatorId}, 
        moderation_reason = ${reason || ''}, updated_at = NOW()
    WHERE id = ${report.id}
  `;

  return { action: 'hidden', content_id: report.content_id };
}

async function deleteContent(report, moderatorId, reason) {
  if (report.content_type === 'prompt') {
    await sql`
      UPDATE prompts 
      SET is_public = false, moderation_status = 'deleted'
      WHERE id = ${report.content_id}
    `;
  } else if (report.content_type === 'collection') {
    await sql`
      UPDATE collections 
      SET is_public = false, moderation_status = 'deleted'
      WHERE id = ${report.content_id}
    `;
  }

  // Update report status
  await sql`
    UPDATE reports 
    SET status = 'action_taken', moderator_id = ${moderatorId}, 
        moderation_reason = ${reason || ''}, updated_at = NOW()
    WHERE id = ${report.id}
  `;

  return { action: 'deleted', content_id: report.content_id };
}

async function suspendUser(report, moderatorId, reason) {
  // Get content author
  let authorId;
  if (report.content_type === 'prompt') {
    const promptResult = await sql`
      SELECT author_id FROM prompts WHERE id = ${report.content_id}
    `;
    authorId = promptResult.rows[0]?.author_id;
  } else if (report.content_type === 'collection') {
    const collectionResult = await sql`
      SELECT user_id FROM collections WHERE id = ${report.content_id}
    `;
    authorId = collectionResult.rows[0]?.user_id;
  } else if (report.content_type === 'user') {
    authorId = report.content_id;
  }

  if (authorId) {
    // Suspend user for 7 days
    const suspensionEnd = new Date();
    suspensionEnd.setDate(suspensionEnd.getDate() + 7);

    await sql`
      UPDATE users 
      SET is_suspended = true, suspension_end = ${suspensionEnd.toISOString()},
          suspension_reason = ${reason || 'Content policy violation'}
      WHERE id = ${authorId}
    `;

    // Hide all user's public content
    await sql`
      UPDATE prompts 
      SET is_public = false, moderation_status = 'hidden'
      WHERE author_id = ${authorId} AND is_public = true
    `;

    await sql`
      UPDATE collections 
      SET is_public = false, moderation_status = 'hidden'
      WHERE user_id = ${authorId} AND is_public = true
    `;
  }

  return { action: 'suspended', user_id: authorId, duration: '7 days' };
}

async function banUser(report, moderatorId, reason) {
  // Get content author
  let authorId;
  if (report.content_type === 'prompt') {
    const promptResult = await sql`
      SELECT author_id FROM prompts WHERE id = ${report.content_id}
    `;
    authorId = promptResult.rows[0]?.author_id;
  } else if (report.content_type === 'collection') {
    const collectionResult = await sql`
      SELECT user_id FROM collections WHERE id = ${report.content_id}
    `;
    authorId = collectionResult.rows[0]?.user_id;
  } else if (report.content_type === 'user') {
    authorId = report.content_id;
  }

  if (authorId) {
    // Permanently ban user
    await sql`
      UPDATE users 
      SET is_banned = true, ban_reason = ${reason || 'Serious content policy violation'},
          is_active = false
      WHERE id = ${authorId}
    `;

    // Hide all user's content
    await sql`
      UPDATE prompts 
      SET is_public = false, moderation_status = 'hidden'
      WHERE author_id = ${authorId}
    `;

    await sql`
      UPDATE collections 
      SET is_public = false, moderation_status = 'hidden'
      WHERE user_id = ${authorId}
    `;
  }

  return { action: 'banned', user_id: authorId };
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
