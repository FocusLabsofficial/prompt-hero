-- Prompt Hero Database Schema
-- PostgreSQL schema for NeonDB

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(100),
    avatar_url TEXT,
    bio TEXT,
    website VARCHAR(255),
    github_username VARCHAR(50),
    twitter_username VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    is_moderator BOOLEAN DEFAULT false,
    is_suspended BOOLEAN DEFAULT false,
    is_banned BOOLEAN DEFAULT false,
    suspension_end TIMESTAMP WITH TIME ZONE,
    suspension_reason TEXT,
    ban_reason TEXT,
    warning_count INTEGER DEFAULT 0,
    last_login TIMESTAMP WITH TIME ZONE
);

-- Tags table
CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User follows table for social features
CREATE TABLE user_follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(follower_id, following_id)
);

-- Shares table for tracking content sharing
CREATE TABLE shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('prompt', 'collection')),
    content_id UUID NOT NULL,
    share_platform VARCHAR(20) NOT NULL,
    message TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports table for content moderation
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('prompt', 'collection', 'user', 'comment')),
    content_id UUID NOT NULL,
    reason VARCHAR(50) NOT NULL,
    description TEXT,
    evidence_urls JSONB DEFAULT '[]',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'flagged', 'action_taken')),
    moderator_id UUID REFERENCES users(id),
    moderation_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Moderation actions table
CREATE TABLE moderation_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    moderator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL,
    reason TEXT,
    content_type VARCHAR(20),
    content_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User warnings table
CREATE TABLE user_warnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    moderator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    content_type VARCHAR(20),
    content_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics events table
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(50) NOT NULL,
    content_type VARCHAR(20),
    content_id UUID,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id VARCHAR(100),
    user_agent TEXT,
    ip_address INET,
    referer TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompts table
CREATE TABLE prompts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_ratings INTEGER DEFAULT 0,
    total_favorites INTEGER DEFAULT 0,
    difficulty_level VARCHAR(20) DEFAULT 'beginner' CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')),
    estimated_tokens INTEGER,
    language VARCHAR(10) DEFAULT 'en',
    version INTEGER DEFAULT 1
);

-- Ratings table
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review TEXT,
    is_helpful BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(prompt_id, user_id)
);

-- User profiles table
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url TEXT,
    website_url TEXT,
    location VARCHAR(100),
    followers_count INTEGER DEFAULT 0,
    following_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Collections table
CREATE TABLE collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    share_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    total_prompts INTEGER DEFAULT 0,
    total_followers INTEGER DEFAULT 0
);

-- Collection prompts junction table
CREATE TABLE collection_prompts (
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    added_by UUID REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (collection_id, prompt_id)
);

-- Favorites table
CREATE TABLE favorites (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, prompt_id)
);

-- Follows table (user following collections)
CREATE TABLE collection_follows (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, collection_id)
);

-- User follows table (user following other users)
CREATE TABLE user_follows (
    follower_id UUID REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id != following_id)
);

-- Comments table
CREATE TABLE comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reports table
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Analytics table
CREATE TABLE analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    prompt_id UUID REFERENCES prompts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL, -- 'view', 'copy', 'rate', 'favorite', 'share'
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_prompts_category ON prompts(category);
CREATE INDEX idx_prompts_author ON prompts(author_id);
CREATE INDEX idx_prompts_created_at ON prompts(created_at DESC);
CREATE INDEX idx_prompts_rating ON prompts(average_rating DESC);
CREATE INDEX idx_prompts_usage ON prompts(usage_count DESC);
CREATE INDEX idx_prompts_public ON prompts(is_public) WHERE is_public = true;
CREATE INDEX idx_prompts_featured ON prompts(is_featured) WHERE is_featured = true;

CREATE INDEX idx_ratings_prompt ON ratings(prompt_id);
CREATE INDEX idx_ratings_user ON ratings(user_id);
CREATE INDEX idx_ratings_rating ON ratings(rating);

CREATE INDEX idx_collections_owner ON collections(owner_id);
CREATE INDEX idx_collections_public ON collections(is_public) WHERE is_public = true;
CREATE INDEX idx_collections_featured ON collections(is_featured) WHERE is_featured = true;

CREATE INDEX idx_favorites_user ON favorites(user_id);
CREATE INDEX idx_favorites_prompt ON favorites(prompt_id);

CREATE INDEX idx_comments_prompt ON comments(prompt_id);
CREATE INDEX idx_comments_user ON comments(user_id);
CREATE INDEX idx_comments_parent ON comments(parent_id);

CREATE INDEX idx_analytics_prompt ON analytics(prompt_id);
CREATE INDEX idx_analytics_event ON analytics(event_type);
CREATE INDEX idx_analytics_created ON analytics(created_at DESC);

-- Full text search indexes
CREATE INDEX idx_prompts_search ON prompts USING gin(to_tsvector('english', title || ' ' || description || ' ' || content));
CREATE INDEX idx_tags_search ON tags USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ratings_updated_at BEFORE UPDATE ON ratings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tags_updated_at BEFORE UPDATE ON tags FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update prompt statistics
CREATE OR REPLACE FUNCTION update_prompt_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE prompts SET
            total_ratings = (SELECT COUNT(*) FROM ratings WHERE prompt_id = NEW.prompt_id),
            average_rating = (SELECT COALESCE(AVG(rating), 0) FROM ratings WHERE prompt_id = NEW.prompt_id),
            total_favorites = (SELECT COUNT(*) FROM favorites WHERE prompt_id = NEW.prompt_id)
        WHERE id = NEW.prompt_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE prompts SET
            total_ratings = (SELECT COUNT(*) FROM ratings WHERE prompt_id = OLD.prompt_id),
            average_rating = (SELECT COALESCE(AVG(rating), 0) FROM ratings WHERE prompt_id = OLD.prompt_id),
            total_favorites = (SELECT COUNT(*) FROM favorites WHERE prompt_id = OLD.prompt_id)
        WHERE id = OLD.prompt_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Triggers for prompt statistics
CREATE TRIGGER update_prompt_stats_on_rating AFTER INSERT OR UPDATE OR DELETE ON ratings FOR EACH ROW EXECUTE FUNCTION update_prompt_stats();
CREATE TRIGGER update_prompt_stats_on_favorite AFTER INSERT OR DELETE ON favorites FOR EACH ROW EXECUTE FUNCTION update_prompt_stats();

-- Function to update collection statistics
CREATE OR REPLACE FUNCTION update_collection_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE collections SET
            total_prompts = (SELECT COUNT(*) FROM collection_prompts WHERE collection_id = NEW.collection_id),
            total_followers = (SELECT COUNT(*) FROM collection_follows WHERE collection_id = NEW.collection_id)
        WHERE id = NEW.collection_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE collections SET
            total_prompts = (SELECT COUNT(*) FROM collection_prompts WHERE collection_id = OLD.collection_id),
            total_followers = (SELECT COUNT(*) FROM collection_follows WHERE collection_id = OLD.collection_id)
        WHERE id = OLD.collection_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Triggers for collection statistics
CREATE TRIGGER update_collection_stats_on_prompt AFTER INSERT OR DELETE ON collection_prompts FOR EACH ROW EXECUTE FUNCTION update_collection_stats();
CREATE TRIGGER update_collection_stats_on_follow AFTER INSERT OR DELETE ON collection_follows FOR EACH ROW EXECUTE FUNCTION update_collection_stats();

-- Insert default categories and tags
INSERT INTO tags (name, description) VALUES
('development', 'Programming and software development prompts'),
('creative', 'Creative writing, art, and design prompts'),
('business', 'Business strategy, marketing, and analysis prompts'),
('education', 'Teaching, learning, and educational prompts'),
('research', 'Research and academic writing prompts'),
('productivity', 'Productivity and workflow optimization prompts'),
('ai', 'Artificial intelligence and machine learning prompts'),
('writing', 'General writing and content creation prompts'),
('code', 'Code generation and programming assistance prompts'),
('analysis', 'Data analysis and interpretation prompts'),
('strategy', 'Strategic planning and decision-making prompts'),
('communication', 'Communication and presentation prompts'),
('technical', 'Technical documentation and system prompts'),
('creative-writing', 'Creative writing and storytelling prompts'),
('business-analysis', 'Business analysis and reporting prompts'),
('learning', 'Learning and educational content prompts'),
('problem-solving', 'Problem-solving and troubleshooting prompts'),
('optimization', 'Performance and process optimization prompts'),
('documentation', 'Documentation and technical writing prompts'),
('review', 'Review and feedback prompts')
ON CONFLICT (name) DO NOTHING;
