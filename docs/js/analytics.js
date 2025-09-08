// Analytics tracking for Prompt Hero
class Analytics {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.userId = null;
        this.isEnabled = true;
        this.queue = [];
        this.flushInterval = 30000; // 30 seconds
        this.maxQueueSize = 50;
        this.init();
    }

    init() {
        // Load user ID from auth manager if available
        if (window.authManager && window.authManager.isUserAuthenticated()) {
            this.userId = window.authManager.getCurrentUser()?.id;
        }

        // Listen for auth state changes
        document.addEventListener('authStateChanged', (event) => {
            if (event.detail.isAuthenticated) {
                this.userId = event.detail.user?.id;
            } else {
                this.userId = null;
            }
        });

        // Set up automatic flushing
        setInterval(() => {
            this.flush();
        }, this.flushInterval);

        // Flush on page unload
        window.addEventListener('beforeunload', () => {
            this.flush(true);
        });

        // Track page view
        this.track('page_view', {
            page: window.location.pathname,
            referrer: document.referrer,
            user_agent: navigator.userAgent
        });
    }

    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    track(eventType, metadata = {}) {
        if (!this.isEnabled) return;

        const event = {
            event_type: eventType,
            user_id: this.userId,
            session_id: this.sessionId,
            metadata: {
                timestamp: new Date().toISOString(),
                url: window.location.href,
                ...metadata
            }
        };

        this.queue.push(event);

        // Flush if queue is full
        if (this.queue.length >= this.maxQueueSize) {
            this.flush();
        }
    }

    async flush(sync = false) {
        if (this.queue.length === 0) return;

        const events = [...this.queue];
        this.queue = [];

        try {
            const response = await fetch('/api/analytics/track', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(events)
            });

            if (!response.ok) {
                console.warn('Analytics tracking failed:', response.status);
                // Re-queue events if they failed to send
                this.queue.unshift(...events);
            }
        } catch (error) {
            console.warn('Analytics tracking error:', error);
            // Re-queue events if they failed to send
            this.queue.unshift(...events);
        }
    }

    // Specific tracking methods
    trackPageView(page, metadata = {}) {
        this.track('page_view', {
            page,
            ...metadata
        });
    }

    trackPromptView(promptId, metadata = {}) {
        this.track('prompt_view', {
            content_type: 'prompt',
            content_id: promptId,
            ...metadata
        });
    }

    trackPromptCopy(promptId, metadata = {}) {
        this.track('prompt_copy', {
            content_type: 'prompt',
            content_id: promptId,
            ...metadata
        });
    }

    trackPromptFavorite(promptId, metadata = {}) {
        this.track('prompt_favorite', {
            content_type: 'prompt',
            content_id: promptId,
            ...metadata
        });
    }

    trackPromptUnfavorite(promptId, metadata = {}) {
        this.track('prompt_unfavorite', {
            content_type: 'prompt',
            content_id: promptId,
            ...metadata
        });
    }

    trackPromptRating(promptId, rating, metadata = {}) {
        this.track('prompt_rating', {
            content_type: 'prompt',
            content_id: promptId,
            rating,
            ...metadata
        });
    }

    trackPromptShare(promptId, platform, metadata = {}) {
        this.track('prompt_share', {
            content_type: 'prompt',
            content_id: promptId,
            platform,
            ...metadata
        });
    }

    trackCollectionView(collectionId, metadata = {}) {
        this.track('collection_view', {
            content_type: 'collection',
            content_id: collectionId,
            ...metadata
        });
    }

    trackCollectionFollow(collectionId, metadata = {}) {
        this.track('collection_follow', {
            content_type: 'collection',
            content_id: collectionId,
            ...metadata
        });
    }

    trackCollectionUnfollow(collectionId, metadata = {}) {
        this.track('collection_unfollow', {
            content_type: 'collection',
            content_id: collectionId,
            ...metadata
        });
    }

    trackUserFollow(userId, metadata = {}) {
        this.track('user_follow', {
            content_type: 'user',
            content_id: userId,
            ...metadata
        });
    }

    trackUserUnfollow(userId, metadata = {}) {
        this.track('user_unfollow', {
            content_type: 'user',
            content_id: userId,
            ...metadata
        });
    }

    trackSearch(query, resultsCount, metadata = {}) {
        this.track('search', {
            query,
            results_count: resultsCount,
            ...metadata
        });
    }

    trackFilterApply(filters, resultsCount, metadata = {}) {
        this.track('filter_apply', {
            filters,
            results_count: resultsCount,
            ...metadata
        });
    }

    trackSignup(method, metadata = {}) {
        this.track('signup', {
            method,
            ...metadata
        });
    }

    trackLogin(method, metadata = {}) {
        this.track('login', {
            method,
            ...metadata
        });
    }

    trackLogout(metadata = {}) {
        this.track('logout', metadata);
    }

    // Utility methods
    enable() {
        this.isEnabled = true;
    }

    disable() {
        this.isEnabled = false;
    }

    setUserId(userId) {
        this.userId = userId;
    }

    getSessionId() {
        return this.sessionId;
    }

    getQueueSize() {
        return this.queue.length;
    }

    // Performance tracking
    trackPerformance(metric, value, metadata = {}) {
        this.track('performance', {
            metric,
            value,
            ...metadata
        });
    }

    // Error tracking
    trackError(error, context = {}) {
        this.track('error', {
            error_message: error.message,
            error_stack: error.stack,
            context,
            ...context
        });
    }

    // User interaction tracking
    trackClick(element, metadata = {}) {
        this.track('click', {
            element: element.tagName,
            element_id: element.id,
            element_class: element.className,
            ...metadata
        });
    }

    trackFormSubmit(formId, metadata = {}) {
        this.track('form_submit', {
            form_id: formId,
            ...metadata
        });
    }

    trackFormError(formId, error, metadata = {}) {
        this.track('form_error', {
            form_id: formId,
            error,
            ...metadata
        });
    }
}

// Global analytics instance
window.analytics = new Analytics();

// Auto-track common interactions
document.addEventListener('DOMContentLoaded', () => {
    // Track clicks on important elements
    document.addEventListener('click', (e) => {
        const element = e.target;
        
        // Track prompt interactions
        if (element.classList.contains('prompt-card')) {
            const promptId = element.dataset.promptId;
            if (promptId) {
                window.analytics.trackPromptView(promptId);
            }
        }

        // Track copy button clicks
        if (element.classList.contains('copy-btn')) {
            const promptId = element.closest('.prompt-card')?.dataset.promptId;
            if (promptId) {
                window.analytics.trackPromptCopy(promptId);
            }
        }

        // Track favorite button clicks
        if (element.classList.contains('favorite-btn')) {
            const promptId = element.closest('.prompt-card')?.dataset.promptId;
            if (promptId) {
                const isFavorited = element.classList.contains('favorited');
                if (isFavorited) {
                    window.analytics.trackPromptUnfavorite(promptId);
                } else {
                    window.analytics.trackPromptFavorite(promptId);
                }
            }
        }

        // Track rating button clicks
        if (element.classList.contains('rate-btn')) {
            const promptId = element.closest('.prompt-card')?.dataset.promptId;
            if (promptId) {
                window.analytics.track('prompt_rating_click', {
                    content_type: 'prompt',
                    content_id: promptId
                });
            }
        }

        // Track share button clicks
        if (element.classList.contains('share-btn')) {
            const promptId = element.closest('.prompt-card')?.dataset.promptId;
            const platform = element.dataset.platform;
            if (promptId && platform) {
                window.analytics.trackPromptShare(promptId, platform);
            }
        }
    });

    // Track form submissions
    document.addEventListener('submit', (e) => {
        const form = e.target;
        if (form.tagName === 'FORM') {
            window.analytics.trackFormSubmit(form.id || form.className);
        }
    });

    // Track search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                if (e.target.value.length > 2) {
                    window.analytics.trackSearch(e.target.value);
                }
            }, 1000);
        });
    }

    // Track filter applications
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-chip')) {
            const filterType = e.target.dataset.category || e.target.dataset.difficulty || e.target.dataset.featured;
            if (filterType) {
                window.analytics.trackFilterApply({ [filterType]: e.target.textContent });
            }
        }
    });
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Analytics;
}
