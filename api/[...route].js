import fs from 'fs';
import path from 'path';

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

async function readPromptsJson() {
  try {
    const filePath = path.join(process.cwd(), 'docs', 'prompts.json');
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? { prompts: parsed } : parsed;
  } catch (err) {
    return { prompts: [] };
  }
}

function parseIdFromUrl(url, base) {
  const withoutBase = url.replace(base, '');
  const parts = withoutBase.split('/').filter(Boolean);
  return parts[0] || null;
}

export default async function handler(req, res) {
  try {
    const url = req.url || '';
    const method = req.method || 'GET';

    // Health check
    if (url === '/api/health') {
      return send(res, 200, { ok: true });
    }

    // Prompts list and create
    if (url.startsWith('/api/prompts') && (url === '/api/prompts' || url.startsWith('/api/prompts?'))) {
      const data = await readPromptsJson();

      if (method === 'GET') {
        // Basic filtering (query param: q, category)
        const u = new URL('http://localhost' + url);
        const q = (u.searchParams.get('q') || u.searchParams.get('search') || '').toLowerCase();
        const category = (u.searchParams.get('category') || '').toLowerCase();

        let prompts = data.prompts || [];
        if (q) {
          prompts = prompts.filter(p =>
            (p.title || '').toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q) ||
            (p.content || '').toLowerCase().includes(q)
          );
        }
        if (category && category !== 'all') {
          prompts = prompts.filter(p => (p.category || '').toLowerCase() === category);
        }

        return send(res, 200, { prompts, pagination: { page: 1, limit: prompts.length, total: prompts.length } });
      }

      if (method === 'POST') {
        // Not persisting in Hobby consolidation; acknowledge only
        return send(res, 201, { message: 'Created (ephemeral in consolidated mode)' });
      }

      return send(res, 405, { error: 'Method not allowed' });
    }

    // Prompt by id
    if (url.startsWith('/api/prompts/')) {
      const id = parseIdFromUrl(url, '/api/prompts/');
      const data = await readPromptsJson();
      const prompt = (data.prompts || []).find(p => String(p.id) === String(id));
      if (!prompt) return send(res, 404, { error: 'Prompt not found' });

      if (method === 'GET') return send(res, 200, { prompt });
      if (method === 'PUT' || method === 'DELETE') {
        return send(res, 200, { message: `${method} acknowledged (ephemeral in consolidated mode)` });
      }
      return send(res, 405, { error: 'Method not allowed' });
    }

    // Fallback for other routes during consolidation
    if (url.startsWith('/api/')) {
      return send(res, 501, { error: 'Endpoint consolidated for Vercel Hobby limit. To enable, extend router in api/[...route].js.' });
    }

    // Non-API
    return send(res, 404, { error: 'Not found' });
  } catch (e) {
    return send(res, 500, { error: 'Internal error', details: e?.message });
  }
}


