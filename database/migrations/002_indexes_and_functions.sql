-- Migration 002: Indexes and Functions
-- This migration adds performance indexes and utility functions

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
CREATE INDEX IF NOT EXISTS idx_prompts_author ON prompts(author_id);
CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_rating ON prompts(average_rating DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_usage ON prompts(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_prompts_public ON prompts(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_prompts_featured ON prompts(is_featured) WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_ratings_prompt ON ratings(prompt_id);
CREATE INDEX IF NOT EXISTS idx_ratings_user ON ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_ratings_rating ON ratings(rating);

CREATE INDEX IF NOT EXISTS idx_collections_owner ON collections(owner_id);
CREATE INDEX IF NOT EXISTS idx_collections_public ON collections(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_collections_featured ON collections(is_featured) WHERE is_featured = true;

CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_prompt ON favorites(prompt_id);

CREATE INDEX IF NOT EXISTS idx_comments_prompt ON comments(prompt_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);

CREATE INDEX IF NOT EXISTS idx_analytics_prompt ON analytics(prompt_id);
CREATE INDEX IF NOT EXISTS idx_analytics_event ON analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics(created_at DESC);

-- Full text search indexes
CREATE INDEX IF NOT EXISTS idx_prompts_search ON prompts USING gin(to_tsvector('english', title || ' ' || description || ' ' || content));
CREATE INDEX IF NOT EXISTS idx_tags_search ON tags USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));

-- Functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prompts_updated_at ON prompts;
CREATE TRIGGER update_prompts_updated_at BEFORE UPDATE ON prompts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ratings_updated_at ON ratings;
CREATE TRIGGER update_ratings_updated_at BEFORE UPDATE ON ratings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_collections_updated_at ON collections;
CREATE TRIGGER update_collections_updated_at BEFORE UPDATE ON collections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tags_updated_at ON tags;
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
DROP TRIGGER IF EXISTS update_prompt_stats_on_rating ON ratings;
CREATE TRIGGER update_prompt_stats_on_rating AFTER INSERT OR UPDATE OR DELETE ON ratings FOR EACH ROW EXECUTE FUNCTION update_prompt_stats();

DROP TRIGGER IF EXISTS update_prompt_stats_on_favorite ON favorites;
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
DROP TRIGGER IF EXISTS update_collection_stats_on_prompt ON collection_prompts;
CREATE TRIGGER update_collection_stats_on_prompt AFTER INSERT OR DELETE ON collection_prompts FOR EACH ROW EXECUTE FUNCTION update_collection_stats();

DROP TRIGGER IF EXISTS update_collection_stats_on_follow ON collection_follows;
CREATE TRIGGER update_collection_stats_on_follow AFTER INSERT OR DELETE ON collection_follows FOR EACH ROW EXECUTE FUNCTION update_collection_stats();
