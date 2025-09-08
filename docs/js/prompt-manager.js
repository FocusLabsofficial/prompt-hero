// Prompt Manager - Handles prompt cards, ratings, favorites, and collections
class PromptManager {
    constructor() {
        this.prompts = [];
        this.favorites = [];
        this.collections = [];
        this.currentUser = null;
        this.init();
    }

    init() {
        this.loadFavoritesFromStorage();
        this.loadCollectionsFromStorage();
        this.setupEventListeners();
    }

    // Load favorites from localStorage
    loadFavoritesFromStorage() {
        try {
            const stored = localStorage.getItem('prompthero_favorites');
            this.favorites = stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading favorites:', error);
            this.favorites = [];
        }
    }

    // Save favorites to localStorage
    saveFavoritesToStorage() {
        try {
            localStorage.setItem('prompthero_favorites', JSON.stringify(this.favorites));
        } catch (error) {
            console.error('Error saving favorites:', error);
        }
    }

    // Load collections from localStorage
    loadCollectionsFromStorage() {
        try {
            const stored = localStorage.getItem('prompthero_collections');
            this.collections = stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading collections:', error);
            this.collections = [];
        }
    }

    // Save collections to localStorage
    saveCollectionsToStorage() {
        try {
            localStorage.setItem('prompthero_collections', JSON.stringify(this.collections));
        } catch (error) {
            console.error('Error saving collections:', error);
        }
    }

    // Setup event listeners
    setupEventListeners() {
        // Handle copy button clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('copy-prompt-btn')) {
                this.copyPrompt(e.target);
            }
            
            if (e.target.classList.contains('favorite-btn')) {
                this.toggleFavorite(e.target);
            }
            
            if (e.target.classList.contains('rate-btn')) {
                this.showRatingModal(e.target);
            }
            
            if (e.target.classList.contains('rating-star')) {
                this.ratePrompt(e.target);
            }
        });
    }

    // Create a prompt card element
    createPromptCard(prompt) {
        const card = document.createElement('div');
        card.className = 'prompt-card';
        card.dataset.promptId = prompt.id;
        
        const isFavorited = this.favorites.includes(prompt.id);
        const rating = prompt.average_rating || 0;
        const ratingCount = prompt.total_ratings || 0;
        
        card.innerHTML = `
            <div class="prompt-header">
                <div class="prompt-rating">
                    <span class="stars">${this.generateStars(rating)}</span>
                    <span class="rating-count">(${ratingCount})</span>
                </div>
                <h3>${this.escapeHtml(prompt.title)}</h3>
                <div class="prompt-meta">
                    <span class="category category-${prompt.category}">${prompt.category}</span>
                    <span class="author">@${prompt.author || 'anonymous'}</span>
                </div>
            </div>
            <p>${this.escapeHtml(prompt.description || '')}</p>
            <div class="prompt-actions">
                <button class="copy-prompt-btn copy-btn" data-prompt-id="${prompt.id}">
                    Copy Prompt
                </button>
                <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" data-prompt-id="${prompt.id}" title="Add to favorites">
                    ${isFavorited ? '❤️' : '🤍'}
                </button>
                <button class="add-to-collection-btn" data-prompt-id="${prompt.id}" title="Add to collection">
                    📁
                </button>
                <button class="rate-btn" data-prompt-id="${prompt.id}" title="Rate this prompt">
                    ⭐
                </button>
            </div>
        `;
        
        return card;
    }

    // Generate star rating display
    generateStars(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
        
        let stars = '';
        for (let i = 0; i < fullStars; i++) {
            stars += '★';
        }
        if (hasHalfStar) {
            stars += '☆';
        }
        for (let i = 0; i < emptyStars; i++) {
            stars += '☆';
        }
        
        return stars;
    }

    // Copy prompt to clipboard
    async copyPrompt(button) {
        const promptId = button.dataset.promptId;
        const prompt = this.prompts.find(p => p.id === promptId);
        
        if (!prompt) {
            this.showNotification('Prompt not found', 'error');
            return;
        }

        try {
            await navigator.clipboard.writeText(prompt.content);
            this.showNotification('Prompt copied to clipboard!', 'success');
            
            // Update button temporarily
            const originalText = button.textContent;
            button.textContent = 'Copied!';
            button.style.background = 'var(--success-color)';
            
            setTimeout(() => {
                button.textContent = originalText;
                button.style.background = '';
            }, 2000);
            
            // Track analytics
            this.trackEvent('copy', promptId);
            
        } catch (error) {
            console.error('Error copying prompt:', error);
            this.showNotification('Failed to copy prompt', 'error');
        }
    }

    // Toggle favorite status
    toggleFavorite(button) {
        const promptId = button.dataset.promptId;
        const isFavorited = this.favorites.includes(promptId);
        
        if (isFavorited) {
            this.favorites = this.favorites.filter(id => id !== promptId);
            button.textContent = '🤍';
            button.classList.remove('favorited');
            this.showNotification('Removed from favorites', 'info');
        } else {
            this.favorites.push(promptId);
            button.textContent = '❤️';
            button.classList.add('favorited');
            this.showNotification('Added to favorites', 'success');
        }
        
        this.saveFavoritesToStorage();
        this.trackEvent('favorite', promptId, { favorited: !isFavorited });
    }

    // Show rating modal
    showRatingModal(button) {
        const promptId = button.dataset.promptId;
        const prompt = this.prompts.find(p => p.id === promptId);
        
        if (!prompt) {
            this.showNotification('Prompt not found', 'error');
            return;
        }

        // Create rating modal
        const modal = document.createElement('div');
        modal.className = 'rating-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Rate "${prompt.title}"</h3>
                    <button class="modal-close" onclick="this.closest('.rating-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="rating-widget" data-prompt-id="${promptId}">
                        <span class="rating-star" data-rating="1">★</span>
                        <span class="rating-star" data-rating="2">★</span>
                        <span class="rating-star" data-rating="3">★</span>
                        <span class="rating-star" data-rating="4">★</span>
                        <span class="rating-star" data-rating="5">★</span>
                    </div>
                    <textarea class="rating-review" placeholder="Write a review (optional)..." rows="3"></textarea>
                </div>
                <div class="modal-footer">
                    <button class="submit-rating-btn" data-prompt-id="${promptId}">Submit Rating</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Setup rating star interactions
        const stars = modal.querySelectorAll('.rating-star');
        let selectedRating = 0;
        
        stars.forEach((star, index) => {
            star.addEventListener('click', () => {
                selectedRating = index + 1;
                stars.forEach((s, i) => {
                    s.classList.toggle('filled', i < selectedRating);
                });
            });
            
            star.addEventListener('mouseenter', () => {
                stars.forEach((s, i) => {
                    s.classList.toggle('active', i <= index);
                });
            });
        });
        
        modal.querySelector('.rating-widget').addEventListener('mouseleave', () => {
            stars.forEach((s, i) => {
                s.classList.remove('active');
                s.classList.toggle('filled', i < selectedRating);
            });
        });
        
        // Handle submit
        modal.querySelector('.submit-rating-btn').addEventListener('click', () => {
            const review = modal.querySelector('.rating-review').value;
            this.submitRating(promptId, selectedRating, review);
            modal.remove();
        });
    }

    // Submit rating
    async submitRating(promptId, rating, review) {
        if (rating === 0) {
            this.showNotification('Please select a rating', 'warning');
            return;
        }

        try {
            // In a real app, this would make an API call
            // For now, we'll simulate it
            this.showNotification('Rating submitted successfully!', 'success');
            this.trackEvent('rate', promptId, { rating, review });
            
            // Update the prompt's rating display
            this.updatePromptRating(promptId, rating);
            
        } catch (error) {
            console.error('Error submitting rating:', error);
            this.showNotification('Failed to submit rating', 'error');
        }
    }

    // Update prompt rating display
    updatePromptRating(promptId, newRating) {
        const card = document.querySelector(`[data-prompt-id="${promptId}"]`);
        if (card) {
            const starsElement = card.querySelector('.stars');
            const ratingCountElement = card.querySelector('.rating-count');
            
            if (starsElement) {
                starsElement.textContent = this.generateStars(newRating);
            }
            
            if (ratingCountElement) {
                const currentCount = parseInt(ratingCountElement.textContent.match(/\d+/)[0]);
                ratingCountElement.textContent = `(${currentCount + 1})`;
            }
        }
    }

    // Create collection card
    createCollectionCard(collection) {
        const card = document.createElement('div');
        card.className = 'collection-card';
        card.dataset.collectionId = collection.id;
        
        card.innerHTML = `
            <div class="collection-header">
                <div class="collection-icon">📁</div>
                <div class="collection-info">
                    <h3>${this.escapeHtml(collection.name)}</h3>
                    <p>${this.escapeHtml(collection.description || '')}</p>
                </div>
            </div>
            <div class="collection-stats">
                <div class="collection-stat">
                    <span>📄</span>
                    <span>${collection.total_prompts || 0} prompts</span>
                </div>
                <div class="collection-stat">
                    <span>👥</span>
                    <span>${collection.total_followers || 0} followers</span>
                </div>
            </div>
        `;
        
        return card;
    }

    // Show notification
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Hide notification after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Track analytics events
    trackEvent(eventType, promptId, metadata = {}) {
        // In a real app, this would send analytics data
        console.log('Analytics Event:', {
            eventType,
            promptId,
            metadata,
            timestamp: new Date().toISOString()
        });
    }

    // Escape HTML to prevent XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Load prompts from API or local data
    async loadPrompts(filters = {}) {
        try {
            // Try to load from migrated prompts file first
            const response = await fetch('prompts.json');
            if (response.ok) {
                const data = await response.json();
                this.prompts = data.prompts || [];
                console.log(`📦 Loaded ${this.prompts.length} prompts from migration`);
                return this.prompts;
            } else {
                // Fallback to mock data
                this.prompts = this.generateMockPrompts();
                console.log('📦 Using mock prompts data');
                return this.prompts;
            }
        } catch (error) {
            console.error('Error loading prompts:', error);
            // Fallback to mock data
            this.prompts = this.generateMockPrompts();
            this.showNotification('Using sample prompts', 'warning');
            return this.prompts;
        }
    }

    // Generate mock prompts for testing
    generateMockPrompts() {
        return [
            {
                id: '1',
                title: 'AI Code Review Assistant',
                content: 'You are an expert code reviewer with 10+ years of experience. Review the provided code focusing on security vulnerabilities, performance optimizations, code maintainability, and best practices.',
                description: 'Expert code reviewer with 10+ years of experience. Review the provided code focusing on security vulnerabilities, performance optimizations, code maintainability, and best practices.',
                category: 'development',
                author: 'promptmaster',
                average_rating: 4.5,
                total_ratings: 127,
                total_favorites: 89,
                created_at: '2024-01-15T10:30:00Z'
            },
            {
                id: '2',
                title: 'Creative Writing Prompt Generator',
                content: 'Generate creative writing prompts that inspire unique stories. Focus on character development, plot twists, and emotional depth. Provide prompts that challenge writers to explore new genres and perspectives.',
                description: 'Generate creative writing prompts that inspire unique stories. Focus on character development, plot twists, and emotional depth.',
                category: 'creative',
                author: 'writerpro',
                average_rating: 4.2,
                total_ratings: 89,
                total_favorites: 67,
                created_at: '2024-01-14T15:45:00Z'
            },
            {
                id: '3',
                title: 'Business Strategy Analyzer',
                content: 'Analyze business strategies and provide actionable insights. Evaluate market positioning, competitive advantages, risk factors, and growth opportunities. Focus on data-driven recommendations.',
                description: 'Analyze business strategies and provide actionable insights. Evaluate market positioning, competitive advantages, and growth opportunities.',
                category: 'business',
                author: 'bizanalyst',
                average_rating: 4.7,
                total_ratings: 156,
                total_favorites: 134,
                created_at: '2024-01-13T09:20:00Z'
            },
            {
                id: '4',
                title: 'Educational Content Creator',
                content: 'Create engaging educational content that makes complex topics accessible. Break down difficult concepts into digestible parts, use analogies and examples, and ensure the content is suitable for the target audience.',
                description: 'Create engaging educational content that makes complex topics accessible. Break down difficult concepts into digestible parts.',
                category: 'education',
                author: 'edututor',
                average_rating: 4.3,
                total_ratings: 98,
                total_favorites: 76,
                created_at: '2024-01-12T14:10:00Z'
            },
            {
                id: '5',
                title: 'Research Paper Summarizer',
                content: 'Summarize research papers in a clear, concise manner. Extract key findings, methodology, and implications. Present the information in a format suitable for both experts and general audiences.',
                description: 'Summarize research papers in a clear, concise manner. Extract key findings, methodology, and implications.',
                category: 'research',
                author: 'researchpro',
                average_rating: 4.6,
                total_ratings: 112,
                total_favorites: 89,
                created_at: '2024-01-11T11:30:00Z'
            }
        ];
    }

    // Render prompts to the page
    renderPrompts(prompts, containerId = 'unifiedGrid') {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Container not found:', containerId);
            return;
        }

        container.innerHTML = '';
        
        if (prompts.length === 0) {
            container.innerHTML = `
                <div class="no-results">
                    <h3>No prompts found</h3>
                    <p>Try adjusting your search criteria or browse all prompts.</p>
                </div>
            `;
            return;
        }

        prompts.forEach(prompt => {
            const card = this.createPromptCard(prompt);
            container.appendChild(card);
        });
    }

    // Filter prompts based on criteria
    filterPrompts(filters = {}) {
        let filtered = [...this.prompts];

        // Category filter
        if (filters.category && filters.category !== 'all') {
            filtered = filtered.filter(prompt => prompt.category === filters.category);
        }

        // Featured filter
        if (filters.featured) {
            filtered = filtered.filter(prompt => prompt.is_featured);
        }

        // Difficulty filter
        if (filters.difficulty) {
            filtered = filtered.filter(prompt => prompt.difficulty_level === filters.difficulty);
        }

        // Trending filter (high usage and recent)
        if (filters.trending) {
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            filtered = filtered.filter(prompt => {
                const createdDate = new Date(prompt.created_at);
                return prompt.usage_count > 10 && createdDate > oneWeekAgo;
            });
        }

        // Search query
        if (filters.query) {
            const query = filters.query.toLowerCase();
            filtered = filtered.filter(prompt => 
                prompt.title.toLowerCase().includes(query) ||
                prompt.description.toLowerCase().includes(query) ||
                prompt.tags.some(tag => tag.toLowerCase().includes(query))
            );
        }

        // Sort by relevance
        if (filters.sort) {
            switch (filters.sort) {
                case 'rating':
                    filtered.sort((a, b) => b.average_rating - a.average_rating);
                    break;
                case 'popular':
                    filtered.sort((a, b) => b.usage_count - a.usage_count);
                    break;
                case 'recent':
                    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                    break;
                case 'trending':
                    filtered.sort((a, b) => (b.usage_count + b.total_favorites) - (a.usage_count + a.total_favorites));
                    break;
                default:
                    // Default: featured first, then by rating
                    filtered.sort((a, b) => {
                        if (a.is_featured !== b.is_featured) {
                            return b.is_featured - a.is_featured;
                        }
                        return b.average_rating - a.average_rating;
                    });
            }
        }

        return filtered;
    }

    // Update filter UI
    updateFilterUI(activeFilter) {
        // Remove active class from all filter chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.remove('active');
        });

        // Add active class to selected filter
        const activeChip = document.querySelector(`[data-filter="${activeFilter}"]`);
        if (activeChip) {
            activeChip.classList.add('active');
        }
    }
}

// Global filter functions
function setPromptFilter(filterType) {
    if (!window.promptManager) return;
    
    const filters = {};
    
    // Determine filter type and set appropriate filter
    if (['development', 'creative', 'business', 'education', 'research', 'technical'].includes(filterType)) {
        filters.category = filterType;
    } else if (['beginner', 'intermediate', 'advanced'].includes(filterType)) {
        filters.difficulty = filterType;
    } else if (filterType === 'featured') {
        filters.featured = true;
    } else if (filterType === 'trending') {
        filters.trending = true;
        filters.sort = 'trending';
    }
    
    // Apply filters and render
    const filteredPrompts = window.promptManager.filterPrompts(filters);
    window.promptManager.renderPrompts(filteredPrompts);
    window.promptManager.updateFilterUI(filterType);
    
    // Update results count
    updateResultsCount(filteredPrompts.length);
}

function updateResultsCount(count) {
    const resultsInfo = document.getElementById('searchResultsInfo');
    const resultsCount = document.getElementById('resultsCount');
    
    if (resultsInfo && resultsCount) {
        resultsCount.textContent = `Found ${count} prompts`;
        resultsInfo.style.display = count > 0 ? 'block' : 'none';
    }
}

// Enhanced search functionality
function performPromptSearch(query) {
    if (!window.promptManager) return;
    
    const filters = {
        query: query,
        sort: 'relevance'
    };
    
    const filteredPrompts = window.promptManager.filterPrompts(filters);
    window.promptManager.renderPrompts(filteredPrompts);
    updateResultsCount(filteredPrompts.length);
}

// Initialize Prompt Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.promptManager = new PromptManager();
    
    // Load and render initial prompts
    window.promptManager.loadPrompts().then(prompts => {
        window.promptManager.renderPrompts(prompts);
        updateResultsCount(prompts.length);
    });
    
    // Override existing search functionality
    if (window.handleSearchInput) {
        const originalHandleSearchInput = window.handleSearchInput;
        window.handleSearchInput = function(event) {
            const query = event.target.value.trim();
            if (query.length >= 3) {
                performPromptSearch(query);
            } else if (query.length === 0) {
                // Show all prompts when search is cleared
                window.promptManager.renderPrompts(window.promptManager.prompts);
                updateResultsCount(window.promptManager.prompts.length);
            }
        };
    }
});
