# Prompt Hero API Documentation

## Overview

The Prompt Hero API provides endpoints for managing prompts, ratings, favorites, and collections. All endpoints return JSON responses and support CORS for cross-origin requests.

**Base URL:** `https://prompthero.com/api`

## Authentication

Currently, the API uses a simple user ID system. In production, this would be replaced with proper JWT authentication.

## Rate Limiting

- **Rate Limit:** 100 requests per 15 minutes per IP
- **Headers:** Rate limit information is included in response headers
- **Exceeded:** Returns 429 status code when limit is exceeded

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "message": "Detailed error description",
  "code": "ERROR_CODE"
}
```

## Endpoints

### Prompts

#### GET /api/prompts

Retrieve a list of prompts with filtering and pagination.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20, max: 100)
- `category` (string, optional): Filter by category (`development`, `creative`, `business`, `education`, `research`, `technical`)
- `search` (string, optional): Search query
- `sort` (string, optional): Sort field (`created_at`, `updated_at`, `title`, `average_rating`, `usage_count`)
- `order` (string, optional): Sort order (`asc`, `desc`, default: `desc`)
- `featured` (boolean, optional): Filter featured prompts
- `difficulty` (string, optional): Filter by difficulty (`beginner`, `intermediate`, `advanced`)
- `trending` (boolean, optional): Filter trending prompts

**Response:**
```json
{
  "prompts": [
    {
      "id": "uuid",
      "title": "AI Code Review Assistant",
      "content": "You are an expert code reviewer...",
      "description": "Expert code reviewer with 10+ years of experience",
      "category": "development",
      "tags": ["ai", "coding", "review"],
      "author_id": "uuid",
      "author_username": "promptmaster",
      "author_display_name": "Prompt Master",
      "author_avatar_url": "https://...",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "is_public": true,
      "is_featured": true,
      "usage_count": 127,
      "view_count": 89,
      "average_rating": 4.5,
      "total_ratings": 127,
      "total_favorites": 89,
      "difficulty_level": "intermediate",
      "estimated_tokens": 150,
      "language": "en",
      "version": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 479,
    "pages": 24
  }
}
```

#### GET /api/prompts/[id]

Retrieve a specific prompt with details, ratings, and related prompts.

**Response:**
```json
{
  "prompt": {
    "id": "uuid",
    "title": "AI Code Review Assistant",
    "content": "You are an expert code reviewer...",
    "description": "Expert code reviewer with 10+ years of experience",
    "category": "development",
    "tags": ["ai", "coding", "review"],
    "author_id": "uuid",
    "author_username": "promptmaster",
    "author_display_name": "Prompt Master",
    "author_avatar_url": "https://...",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "is_public": true,
    "is_featured": true,
    "usage_count": 127,
    "view_count": 89,
    "average_rating": 4.5,
    "total_ratings": 127,
    "total_favorites": 89,
    "difficulty_level": "intermediate",
    "estimated_tokens": 150,
    "language": "en",
    "version": 1
  },
  "ratings": [
    {
      "id": "uuid",
      "rating": 5,
      "review": "Excellent prompt! Very helpful for code reviews.",
      "created_at": "2024-01-16T14:20:00Z",
      "user_id": "uuid",
      "username": "developer123",
      "display_name": "Developer",
      "avatar_url": "https://..."
    }
  ],
  "related": [
    {
      "id": "uuid",
      "title": "Related Prompt",
      "description": "Similar prompt description",
      "category": "development",
      "average_rating": 4.2,
      "total_ratings": 45,
      "author_username": "anotheruser"
    }
  ]
}
```

#### POST /api/prompts

Create a new prompt.

**Request Body:**
```json
{
  "title": "New Prompt Title",
  "content": "Prompt content here...",
  "description": "Optional description",
  "category": "development",
  "tags": ["ai", "coding"],
  "difficulty_level": "intermediate",
  "is_public": true
}
```

**Response:**
```json
{
  "prompt": {
    "id": "uuid",
    "title": "New Prompt Title",
    "content": "Prompt content here...",
    "description": "Optional description",
    "category": "development",
    "tags": ["ai", "coding"],
    "author_id": "uuid",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "is_public": true,
    "is_featured": false,
    "usage_count": 0,
    "view_count": 0,
    "average_rating": 0,
    "total_ratings": 0,
    "total_favorites": 0,
    "difficulty_level": "intermediate",
    "estimated_tokens": 50,
    "language": "en",
    "version": 1
  },
  "message": "Prompt created successfully"
}
```

#### PUT /api/prompts/[id]

Update an existing prompt.

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content...",
  "description": "Updated description",
  "category": "creative",
  "tags": ["ai", "writing"],
  "difficulty_level": "advanced",
  "is_public": false
}
```

**Response:**
```json
{
  "prompt": {
    "id": "uuid",
    "title": "Updated Title",
    "content": "Updated content...",
    "description": "Updated description",
    "category": "creative",
    "tags": ["ai", "writing"],
    "author_id": "uuid",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T11:45:00Z",
    "is_public": false,
    "is_featured": false,
    "usage_count": 0,
    "view_count": 0,
    "average_rating": 0,
    "total_ratings": 0,
    "total_favorites": 0,
    "difficulty_level": "advanced",
    "estimated_tokens": 75,
    "language": "en",
    "version": 1
  },
  "message": "Prompt updated successfully"
}
```

#### DELETE /api/prompts/[id]

Delete a prompt.

**Response:**
```json
{
  "message": "Prompt deleted successfully"
}
```

#### POST /api/prompts/[id]

Rate a prompt.

**Request Body:**
```json
{
  "rating": 5,
  "review": "Excellent prompt!",
  "user_id": "uuid"
}
```

**Response:**
```json
{
  "rating": {
    "id": "uuid",
    "prompt_id": "uuid",
    "user_id": "uuid",
    "rating": 5,
    "review": "Excellent prompt!",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "message": "Rating created successfully"
}
```

#### PUT /api/prompts/[id]

Update prompt usage/view counts.

**Request Body:**
```json
{
  "action": "increment_usage"
}
```

**Response:**
```json
{
  "usage_count": 128,
  "message": "Usage count incremented"
}
```

### Favorites

#### GET /api/favorites

Get user's favorite prompts.

**Query Parameters:**
- `user_id` (string, required): User ID
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)

**Response:**
```json
{
  "favorites": [
    {
      "id": "uuid",
      "title": "AI Code Review Assistant",
      "content": "You are an expert code reviewer...",
      "description": "Expert code reviewer with 10+ years of experience",
      "category": "development",
      "tags": ["ai", "coding", "review"],
      "author_id": "uuid",
      "author_username": "promptmaster",
      "author_display_name": "Prompt Master",
      "author_avatar_url": "https://...",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "is_public": true,
      "is_featured": true,
      "usage_count": 127,
      "view_count": 89,
      "average_rating": 4.5,
      "total_ratings": 127,
      "total_favorites": 89,
      "difficulty_level": "intermediate",
      "estimated_tokens": 150,
      "language": "en",
      "version": 1,
      "favorited_at": "2024-01-16T14:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15,
    "pages": 1
  }
}
```

#### POST /api/favorites

Add a prompt to favorites.

**Request Body:**
```json
{
  "user_id": "uuid",
  "prompt_id": "uuid"
}
```

**Response:**
```json
{
  "favorite": {
    "id": "uuid",
    "user_id": "uuid",
    "prompt_id": "uuid",
    "created_at": "2024-01-15T10:30:00Z"
  },
  "message": "Prompt added to favorites"
}
```

#### DELETE /api/favorites

Remove a prompt from favorites.

**Query Parameters:**
- `user_id` (string, required): User ID
- `prompt_id` (string, required): Prompt ID

**Response:**
```json
{
  "message": "Prompt removed from favorites"
}
```

### Collections

#### GET /api/collections

List collections.

**Query Parameters:**
- `user_id` (string, optional): Filter by user
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)
- `public_only` (boolean, optional): Show only public collections (default: true)
- `sort` (string, optional): Sort field (`created_at`, `name`, `total_prompts`, `total_followers`)
- `order` (string, optional): Sort order (`asc`, `desc`, default: `desc`)

**Response:**
```json
{
  "collections": [
    {
      "id": "uuid",
      "name": "AI Development Tools",
      "description": "Collection of AI prompts for development",
      "owner_id": "uuid",
      "owner_username": "promptmaster",
      "owner_display_name": "Prompt Master",
      "owner_avatar_url": "https://...",
      "is_public": true,
      "created_at": "2024-01-15T10:30:00Z",
      "total_prompts": 25,
      "total_followers": 12
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 8,
    "pages": 1
  }
}
```

#### POST /api/collections

Create a new collection.

**Request Body:**
```json
{
  "name": "My Collection",
  "description": "Collection description",
  "is_public": true,
  "owner_id": "uuid"
}
```

**Response:**
```json
{
  "collection": {
    "id": "uuid",
    "name": "My Collection",
    "description": "Collection description",
    "owner_id": "uuid",
    "is_public": true,
    "created_at": "2024-01-15T10:30:00Z"
  },
  "message": "Collection created successfully"
}
```

#### PUT /api/collections/[id]

Update a collection.

**Request Body:**
```json
{
  "name": "Updated Collection Name",
  "description": "Updated description",
  "is_public": false
}
```

**Response:**
```json
{
  "collection": {
    "id": "uuid",
    "name": "Updated Collection Name",
    "description": "Updated description",
    "owner_id": "uuid",
    "is_public": false,
    "created_at": "2024-01-15T10:30:00Z"
  },
  "message": "Collection updated successfully"
}
```

#### DELETE /api/collections/[id]

Delete a collection.

**Response:**
```json
{
  "message": "Collection deleted successfully"
}
```

### Collection Prompts

#### GET /api/collections/[id]/prompts

Get prompts in a collection.

**Query Parameters:**
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Items per page (default: 20)

**Response:**
```json
{
  "collection": {
    "id": "uuid",
    "name": "AI Development Tools",
    "description": "Collection of AI prompts for development",
    "owner_id": "uuid",
    "owner_username": "promptmaster",
    "is_public": true,
    "created_at": "2024-01-15T10:30:00Z"
  },
  "prompts": [
    {
      "id": "uuid",
      "title": "AI Code Review Assistant",
      "content": "You are an expert code reviewer...",
      "description": "Expert code reviewer with 10+ years of experience",
      "category": "development",
      "tags": ["ai", "coding", "review"],
      "author_id": "uuid",
      "author_username": "promptmaster",
      "author_display_name": "Prompt Master",
      "author_avatar_url": "https://...",
      "created_at": "2024-01-15T10:30:00Z",
      "updated_at": "2024-01-15T10:30:00Z",
      "is_public": true,
      "is_featured": true,
      "usage_count": 127,
      "view_count": 89,
      "average_rating": 4.5,
      "total_ratings": 127,
      "total_favorites": 89,
      "difficulty_level": "intermediate",
      "estimated_tokens": 150,
      "language": "en",
      "version": 1,
      "added_to_collection_at": "2024-01-16T14:20:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 25,
    "pages": 2
  }
}
```

#### POST /api/collections/[id]/prompts

Add a prompt to a collection.

**Request Body:**
```json
{
  "prompt_id": "uuid"
}
```

**Response:**
```json
{
  "collection_prompt": {
    "id": "uuid",
    "collection_id": "uuid",
    "prompt_id": "uuid",
    "added_at": "2024-01-15T10:30:00Z"
  },
  "message": "Prompt added to collection"
}
```

#### DELETE /api/collections/[id]/prompts

Remove a prompt from a collection.

**Query Parameters:**
- `prompt_id` (string, required): Prompt ID

**Response:**
```json
{
  "message": "Prompt removed from collection"
}
```

## Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `429` - Too Many Requests
- `500` - Internal Server Error

## Examples

### JavaScript/Fetch

```javascript
// Get prompts
const response = await fetch('/api/prompts?category=development&limit=10');
const data = await response.json();
console.log(data.prompts);

// Create a prompt
const newPrompt = await fetch('/api/prompts', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    title: 'My New Prompt',
    content: 'You are a helpful AI assistant...',
    category: 'development',
    tags: ['ai', 'assistant'],
    difficulty_level: 'beginner',
    is_public: true
  })
});

// Rate a prompt
const rating = await fetch('/api/prompts/prompt-id', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    rating: 5,
    review: 'Great prompt!',
    user_id: 'user-id'
  })
});
```

### cURL

```bash
# Get prompts
curl -X GET "https://prompthero.com/api/prompts?category=development&limit=10"

# Create a prompt
curl -X POST "https://prompthero.com/api/prompts" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My New Prompt",
    "content": "You are a helpful AI assistant...",
    "category": "development",
    "tags": ["ai", "assistant"],
    "difficulty_level": "beginner",
    "is_public": true
  }'

# Rate a prompt
curl -X POST "https://prompthero.com/api/prompts/prompt-id" \
  -H "Content-Type: application/json" \
  -d '{
    "rating": 5,
    "review": "Great prompt!",
    "user_id": "user-id"
  }'
```

## SDKs

Official SDKs are planned for:
- JavaScript/Node.js
- Python
- Go
- PHP

## Support

For API support, please contact:
- Email: api@prompthero.com
- Documentation: https://prompthero.com/docs/api
- GitHub Issues: https://github.com/prompthero/prompthero/issues
