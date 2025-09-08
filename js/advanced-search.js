// Advanced Search functionality for Prompt Hero
class AdvancedSearch {
    constructor() {
        this.searchInput = null;
        this.searchSuggestions = null;
        this.searchFilters = null;
        this.currentFilters = {
            search: '',
            category: 'all',
            tags: [],
            difficulty: '',
            featured: false,
            trending: false,
            sort: 'created_at',
            order: 'desc'
        };
        this.searchTimeout = null;
        this.init();
    }

    init() {
        this.setupSearchInput();
        this.setupFilters();
        this.setupEventListeners();
        this.loadSearchState();
    }

    setupSearchInput() {
        this.searchInput = document.getElementById('searchInput');
        if (!this.searchInput) {
            console.warn('Search input not found');
            return;
        }

        // Create suggestions container
        this.searchSuggestions = document.createElement('div');
        this.searchSuggestions.className = 'search-suggestions';
        this.searchSuggestions.style.display = 'none';
        this.searchInput.parentNode.appendChild(this.searchSuggestions);
    }

    setupFilters() {
        this.searchFilters = {
            category: document.querySelectorAll('[data-category]'),
            difficulty: document.querySelectorAll('[data-difficulty]'),
            featured: document.querySelector('[data-featured]'),
            trending: document.querySelector('[data-trending]'),
            sort: document.getElementById('sortSelect'),
            order: document.getElementById('orderSelect')
        };
    }

    setupEventListeners() {
        // Search input events
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.handleSearchInput(e.target.value);
            });

            this.searchInput.addEventListener('focus', () => {
                this.showSuggestions();
            });

            this.searchInput.addEventListener('blur', () => {
                // Delay hiding to allow clicking on suggestions
                setTimeout(() => this.hideSuggestions(), 200);
            });

            this.searchInput.addEventListener('keydown', (e) => {
                this.handleSearchKeydown(e);
            });
        }

        // Filter events
        this.searchFilters.category?.forEach(filter => {
            filter.addEventListener('click', (e) => {
                this.handleCategoryFilter(e.target);
            });
        });

        this.searchFilters.difficulty?.forEach(filter => {
            filter.addEventListener('click', (e) => {
                this.handleDifficultyFilter(e.target);
            });
        });

        if (this.searchFilters.featured) {
            this.searchFilters.featured.addEventListener('click', (e) => {
                this.handleFeaturedFilter(e.target);
            });
        }

        if (this.searchFilters.trending) {
            this.searchFilters.trending.addEventListener('click', (e) => {
                this.handleTrendingFilter(e.target);
            });
        }

        if (this.searchFilters.sort) {
            this.searchFilters.sort.addEventListener('change', (e) => {
                this.handleSortChange(e.target.value);
            });
        }

        if (this.searchFilters.order) {
            this.searchFilters.order.addEventListener('change', (e) => {
                this.handleOrderChange(e.target.value);
            });
        }

        // Tag filter events
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tag-filter')) {
                this.handleTagFilter(e.target);
            }
        });

        // Clear filters
        const clearFiltersBtn = document.getElementById('clearFilters');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.clearAllFilters();
            });
        }
    }

    handleSearchInput(value) {
        this.currentFilters.search = value;
        
        // Clear existing timeout
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        // Debounce search
        this.searchTimeout = setTimeout(() => {
            this.performSearch();
            this.getSearchSuggestions(value);
        }, 300);
    }

    handleSearchKeydown(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.performSearch();
        } else if (e.key === 'Escape') {
            this.hideSuggestions();
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.navigateSuggestions(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.navigateSuggestions(-1);
        }
    }

    handleCategoryFilter(element) {
        const category = element.getAttribute('data-category');
        this.currentFilters.category = category;
        
        // Update UI
        this.searchFilters.category.forEach(filter => {
            filter.classList.toggle('active', filter === element);
        });

        this.performSearch();
    }

    handleDifficultyFilter(element) {
        const difficulty = element.getAttribute('data-difficulty');
        this.currentFilters.difficulty = difficulty;
        
        // Update UI
        this.searchFilters.difficulty.forEach(filter => {
            filter.classList.toggle('active', filter === element);
        });

        this.performSearch();
    }

    handleFeaturedFilter(element) {
        this.currentFilters.featured = !this.currentFilters.featured;
        element.classList.toggle('active', this.currentFilters.featured);
        this.performSearch();
    }

    handleTrendingFilter(element) {
        this.currentFilters.trending = !this.currentFilters.trending;
        element.classList.toggle('active', this.currentFilters.trending);
        this.performSearch();
    }

    handleTagFilter(element) {
        const tag = element.textContent.trim();
        const tagIndex = this.currentFilters.tags.indexOf(tag);
        
        if (tagIndex > -1) {
            this.currentFilters.tags.splice(tagIndex, 1);
            element.classList.remove('active');
        } else {
            this.currentFilters.tags.push(tag);
            element.classList.add('active');
        }

        this.performSearch();
    }

    handleSortChange(sort) {
        this.currentFilters.sort = sort;
        this.performSearch();
    }

    handleOrderChange(order) {
        this.currentFilters.order = order;
        this.performSearch();
    }

    async performSearch() {
        try {
            // Show loading state
            this.showLoadingState();

            // Build query parameters
            const params = new URLSearchParams();
            
            if (this.currentFilters.search) {
                params.append('search', this.currentFilters.search);
            }
            if (this.currentFilters.category && this.currentFilters.category !== 'all') {
                params.append('category', this.currentFilters.category);
            }
            if (this.currentFilters.tags.length > 0) {
                params.append('tags', this.currentFilters.tags.join(','));
            }
            if (this.currentFilters.difficulty) {
                params.append('difficulty', this.currentFilters.difficulty);
            }
            if (this.currentFilters.featured) {
                params.append('featured', 'true');
            }
            if (this.currentFilters.trending) {
                params.append('trending', 'true');
            }
            if (this.currentFilters.sort) {
                params.append('sort', this.currentFilters.sort);
            }
            if (this.currentFilters.order) {
                params.append('order', this.currentFilters.order);
            }

            // Make API request
            const response = await fetch(`/api/search?${params.toString()}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Search failed');
            }

            // Update results
            this.updateSearchResults(data);
            this.updateSearchSuggestions(data.suggestions);
            this.saveSearchState();

        } catch (error) {
            console.error('Search error:', error);
            this.showSearchError(error.message);
        }
    }

    async getSearchSuggestions(query) {
        if (!query || query.length < 2) {
            this.hideSuggestions();
            return;
        }

        try {
            const response = await fetch(`/api/search/suggestions?q=${encodeURIComponent(query)}`);
            const data = await response.json();

            if (response.ok) {
                this.showSuggestions(data.suggestions);
            }
        } catch (error) {
            console.error('Error getting suggestions:', error);
        }
    }

    updateSearchResults(data) {
        const { prompts, pagination, suggestions } = data;

        // Update prompt display
        if (window.promptManager) {
            window.promptManager.renderPrompts(prompts);
        }

        // Update results count
        this.updateResultsCount(pagination.total);

        // Update related tags
        this.updateRelatedTags(suggestions.related_tags);

        // Update search suggestions
        this.updateSearchSuggestions(suggestions.search_suggestions);

        // Update pagination
        this.updatePagination(pagination);
    }

    updateResultsCount(total) {
        const resultsInfo = document.getElementById('searchResultsInfo');
        const resultsCount = document.getElementById('resultsCount');
        
        if (resultsInfo && resultsCount) {
            resultsCount.textContent = total;
            resultsInfo.style.display = total > 0 ? 'block' : 'none';
        }
    }

    updateRelatedTags(tags) {
        const relatedTagsContainer = document.getElementById('relatedTags');
        if (!relatedTagsContainer) return;

        if (tags.length === 0) {
            relatedTagsContainer.style.display = 'none';
            return;
        }

        relatedTagsContainer.style.display = 'block';
        relatedTagsContainer.innerHTML = `
            <h4>Related Tags</h4>
            <div class="tag-list">
                ${tags.map(tag => `
                    <span class="tag-filter" data-tag="${tag.tag}">
                        ${this.escapeHtml(tag.tag)} (${tag.frequency})
                    </span>
                `).join('')}
            </div>
        `;
    }

    updateSearchSuggestions(suggestions) {
        if (!this.searchSuggestions) return;

        if (suggestions.length === 0) {
            this.hideSuggestions();
            return;
        }

        this.searchSuggestions.innerHTML = suggestions.map(suggestion => `
            <div class="suggestion-item" data-type="${suggestion.type}">
                <span class="suggestion-text">${this.escapeHtml(suggestion.suggestion)}</span>
                <span class="suggestion-type">${suggestion.type}</span>
            </div>
        `).join('');

        this.showSuggestions();
    }

    showSuggestions() {
        if (this.searchSuggestions && this.searchSuggestions.children.length > 0) {
            this.searchSuggestions.style.display = 'block';
        }
    }

    hideSuggestions() {
        if (this.searchSuggestions) {
            this.searchSuggestions.style.display = 'none';
        }
    }

    navigateSuggestions(direction) {
        const suggestions = this.searchSuggestions?.querySelectorAll('.suggestion-item');
        if (!suggestions || suggestions.length === 0) return;

        const current = this.searchSuggestions.querySelector('.suggestion-item.active');
        let index = current ? Array.from(suggestions).indexOf(current) : -1;
        
        index += direction;
        
        if (index < 0) index = suggestions.length - 1;
        if (index >= suggestions.length) index = 0;

        suggestions.forEach((suggestion, i) => {
            suggestion.classList.toggle('active', i === index);
        });

        if (suggestions[index]) {
            this.searchInput.value = suggestions[index].querySelector('.suggestion-text').textContent;
        }
    }

    updatePagination(pagination) {
        const paginationContainer = document.getElementById('pagination');
        if (!paginationContainer) return;

        if (pagination.total_pages <= 1) {
            paginationContainer.style.display = 'none';
            return;
        }

        paginationContainer.style.display = 'block';
        
        let paginationHTML = '<div class="pagination">';
        
        // Previous button
        if (pagination.has_prev_page) {
            paginationHTML += `<button class="page-btn" data-page="${pagination.page - 1}">Previous</button>`;
        }

        // Page numbers
        const startPage = Math.max(1, pagination.page - 2);
        const endPage = Math.min(pagination.total_pages, pagination.page + 2);

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="page-btn ${i === pagination.page ? 'active' : ''}" data-page="${i}">
                    ${i}
                </button>
            `;
        }

        // Next button
        if (pagination.has_next_page) {
            paginationHTML += `<button class="page-btn" data-page="${pagination.page + 1}">Next</button>`;
        }

        paginationHTML += '</div>';
        paginationContainer.innerHTML = paginationHTML;

        // Add event listeners
        paginationContainer.querySelectorAll('.page-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const page = parseInt(e.target.getAttribute('data-page'));
                this.goToPage(page);
            });
        });
    }

    goToPage(page) {
        this.currentFilters.page = page;
        this.performSearch();
    }

    clearAllFilters() {
        this.currentFilters = {
            search: '',
            category: 'all',
            tags: [],
            difficulty: '',
            featured: false,
            trending: false,
            sort: 'created_at',
            order: 'desc',
            page: 1
        };

        // Reset UI
        if (this.searchInput) {
            this.searchInput.value = '';
        }

        this.searchFilters.category?.forEach(filter => {
            filter.classList.toggle('active', filter.getAttribute('data-category') === 'all');
        });

        this.searchFilters.difficulty?.forEach(filter => {
            filter.classList.remove('active');
        });

        if (this.searchFilters.featured) {
            this.searchFilters.featured.classList.remove('active');
        }

        if (this.searchFilters.trending) {
            this.searchFilters.trending.classList.remove('active');
        }

        // Clear tag filters
        document.querySelectorAll('.tag-filter.active').forEach(tag => {
            tag.classList.remove('active');
        });

        this.performSearch();
    }

    showLoadingState() {
        const loadingIndicator = document.getElementById('searchLoading');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
    }

    hideLoadingState() {
        const loadingIndicator = document.getElementById('searchLoading');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }

    showSearchError(message) {
        if (window.errorHandler) {
            window.errorHandler.showError(`Search failed: ${message}`);
        } else {
            console.error('Search error:', message);
        }
    }

    saveSearchState() {
        try {
            localStorage.setItem('promptHero_searchState', JSON.stringify(this.currentFilters));
        } catch (error) {
            console.error('Error saving search state:', error);
        }
    }

    loadSearchState() {
        try {
            const savedState = localStorage.getItem('promptHero_searchState');
            if (savedState) {
                const state = JSON.parse(savedState);
                this.currentFilters = { ...this.currentFilters, ...state };
                this.applySearchState();
            }
        } catch (error) {
            console.error('Error loading search state:', error);
        }
    }

    applySearchState() {
        // Apply saved search state to UI
        if (this.searchInput && this.currentFilters.search) {
            this.searchInput.value = this.currentFilters.search;
        }

        // Apply filters
        this.searchFilters.category?.forEach(filter => {
            const category = filter.getAttribute('data-category');
            filter.classList.toggle('active', category === this.currentFilters.category);
        });

        this.searchFilters.difficulty?.forEach(filter => {
            const difficulty = filter.getAttribute('data-difficulty');
            filter.classList.toggle('active', difficulty === this.currentFilters.difficulty);
        });

        if (this.searchFilters.featured) {
            this.searchFilters.featured.classList.toggle('active', this.currentFilters.featured);
        }

        if (this.searchFilters.trending) {
            this.searchFilters.trending.classList.toggle('active', this.currentFilters.trending);
        }

        if (this.searchFilters.sort) {
            this.searchFilters.sort.value = this.currentFilters.sort;
        }

        if (this.searchFilters.order) {
            this.searchFilters.order.value = this.currentFilters.order;
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Public methods
    getCurrentFilters() {
        return { ...this.currentFilters };
    }

    setFilter(filterName, value) {
        if (this.currentFilters.hasOwnProperty(filterName)) {
            this.currentFilters[filterName] = value;
            this.performSearch();
        }
    }

    addTagFilter(tag) {
        if (!this.currentFilters.tags.includes(tag)) {
            this.currentFilters.tags.push(tag);
            this.performSearch();
        }
    }

    removeTagFilter(tag) {
        const index = this.currentFilters.tags.indexOf(tag);
        if (index > -1) {
            this.currentFilters.tags.splice(index, 1);
            this.performSearch();
        }
    }
}

// Global advanced search instance
window.advancedSearch = new AdvancedSearch();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedSearch;
}
