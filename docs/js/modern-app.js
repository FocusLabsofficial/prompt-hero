// Modern Prompt Hero Application
// Simplified, performant, and beautiful

class PromptApp {
  constructor() {
    this.prompts = [];
    this.filteredPrompts = [];
    this.filters = {
      category: 'all',
      search: '',
      sort: 'newest',
      difficulty: 'all',
      featured: false
    };
    this.pagination = {
      page: 1,
      limit: 20,
      total: 0
    };
    this.favorites = this.loadFavorites();
    this.isLoading = false;
    
    this.init();
  }

  async init() {
    this.setupEventHandlers();
    await this.loadPrompts();
    this.updateStats();
  }

  setupEventHandlers() {
    // Search input with debouncing
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', this.debounce((e) => {
        this.filters.search = e.target.value.trim();
        this.applyFilters();
      }, 300));
    }

    // Filter chips
    const filterChips = document.querySelectorAll('.filter-chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const category = chip.dataset.category;
        this.setCategory(category);
      });
    });

    // Sort dropdown
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.filters.sort = e.target.value;
        this.applyFilters();
      });
    }

    // Global click handlers for prompt actions
    document.addEventListener('click', this.handleGlobalClick.bind(this));

    // Submit prompt form
    this.setupSubmitForm();
  }

  async loadPrompts() {
    if (this.isLoading) return;
    
    this.isLoading = true;
    this.showLoading(true);

    try {
      const params = new URLSearchParams({
        page: this.pagination.page,
        limit: this.pagination.limit,
        ...this.filters
      });

      const response = await fetch(`/api/prompts?${params}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      this.prompts = data.prompts || [];
      this.pagination = { ...this.pagination, ...data.pagination };
      
      this.renderPrompts();
      this.updateResultsInfo();
      
    } catch (error) {
      console.error('Failed to load prompts:', error);
      this.showError('Failed to load prompts. Please try again.');
    } finally {
      this.isLoading = false;
      this.showLoading(false);
    }
  }

  setCategory(category) {
    // Update active filter chip
    document.querySelectorAll('.filter-chip').forEach(chip => {
      chip.classList.toggle('active', chip.dataset.category === category);
    });

    this.filters.category = category;
    this.applyFilters();
  }

  async applyFilters() {
    this.pagination.page = 1; // Reset to first page
    await this.loadPrompts();
  }

  renderPrompts() {
    const grid = document.getElementById('promptsGrid');
    const emptyState = document.getElementById('emptyState');

    if (!grid) return;

    if (this.prompts.length === 0) {
      grid.style.display = 'none';
      if (emptyState) emptyState.style.display = 'block';
      return;
    }

    grid.style.display = 'grid';
    if (emptyState) emptyState.style.display = 'none';

    grid.innerHTML = this.prompts.map(prompt => this.createPromptCard(prompt)).join('');
  }

  createPromptCard(prompt) {
    const isFavorited = this.favorites.includes(prompt.id);
    const stars = this.generateStars(prompt.average_rating || 0);
    
    return `
      <div class="prompt-card" data-prompt-id="${prompt.id}">
        <div class="prompt-card-header">
          <div class="prompt-meta">
            <span class="badge badge-primary">${this.escapeHtml(prompt.category)}</span>
            ${prompt.is_featured ? '<span class="badge badge-warning">Featured</span>' : ''}
            ${prompt.difficulty_level ? `<span class="badge badge-secondary">${prompt.difficulty_level}</span>` : ''}
          </div>
          <div class="rating">
            <div class="stars">${stars}</div>
            <span class="rating-count">(${prompt.total_ratings || 0})</span>
          </div>
        </div>
        
        <h3 class="prompt-title">${this.escapeHtml(prompt.title)}</h3>
        <p class="prompt-description">${this.escapeHtml(prompt.description || '')}</p>
        
        ${prompt.tags && prompt.tags.length > 0 ? `
          <div class="prompt-tags">
            ${prompt.tags.slice(0, 3).map(tag => `<span class="tag">${this.escapeHtml(tag)}</span>`).join('')}
          </div>
        ` : ''}
        
        <div class="prompt-actions">
          <button class="copy-button" data-action="copy">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
            </svg>
            Copy Prompt
          </button>
          
          <div class="action-buttons">
            <button class="action-btn favorite-btn ${isFavorited ? 'favorited' : ''}" 
                    data-action="favorite" 
                    title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
            </button>
            
            <button class="action-btn share-btn" data-action="share" title="Share prompt">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  generateStars(rating) {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    
    let stars = '';
    
    // Full stars
    for (let i = 0; i < fullStars; i++) {
      stars += '<span class="star filled">★</span>';
    }
    
    // Half star
    if (hasHalfStar) {
      stars += '<span class="star half">★</span>';
    }
    
    // Empty stars
    for (let i = 0; i < emptyStars; i++) {
      stars += '<span class="star">★</span>';
    }
    
    return stars;
  }

  async handleGlobalClick(e) {
    const action = e.target.dataset.action || e.target.closest('[data-action]')?.dataset.action;
    if (!action) return;

    const promptCard = e.target.closest('.prompt-card');
    if (!promptCard) return;

    const promptId = promptCard.dataset.promptId;
    
    switch (action) {
      case 'copy':
        await this.copyPrompt(promptId);
        break;
      case 'favorite':
        this.toggleFavorite(promptId);
        break;
      case 'share':
        this.sharePrompt(promptId);
        break;
    }
  }

  async copyPrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    try {
      await navigator.clipboard.writeText(prompt.content);
      
      // Visual feedback
      const button = document.querySelector(`[data-prompt-id="${promptId}"] .copy-button`);
      if (button) {
        const originalHTML = button.innerHTML;
        
        button.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          Copied!
        `;
        button.classList.add('copied');
        
        setTimeout(() => {
          button.innerHTML = originalHTML;
          button.classList.remove('copied');
        }, 2000);
      }
      
      this.showToast('Prompt copied to clipboard!', 'success');
      
    } catch (error) {
      console.error('Failed to copy prompt:', error);
      this.showToast('Failed to copy prompt', 'error');
    }
  }

  toggleFavorite(promptId) {
    const index = this.favorites.indexOf(promptId);
    
    if (index > -1) {
      this.favorites.splice(index, 1);
    } else {
      this.favorites.push(promptId);
    }
    
    this.saveFavorites();
    
    // Update UI
    const button = document.querySelector(`[data-prompt-id="${promptId}"] .favorite-btn`);
    if (button) {
      button.classList.toggle('favorited');
      button.title = index > -1 ? 'Add to favorites' : 'Remove from favorites';
    }
    
    const message = index > -1 ? 'Removed from favorites' : 'Added to favorites';
    this.showToast(message, 'success');
  }

  sharePrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    if (navigator.share) {
      navigator.share({
        title: prompt.title,
        text: prompt.description,
        url: `${window.location.origin}/?prompt=${promptId}`
      }).catch(console.error);
    } else {
      // Fallback: copy URL to clipboard
      const url = `${window.location.origin}/?prompt=${promptId}`;
      navigator.clipboard.writeText(url).then(() => {
        this.showToast('Prompt URL copied to clipboard!', 'success');
      }).catch(() => {
        this.showToast('Failed to copy URL', 'error');
      });
    }
  }

  setupSubmitForm() {
    // Create submit prompt modal
    const modalHTML = `
      <div class="modal-overlay" id="submitModal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Submit a New Prompt</h3>
            <button class="modal-close" onclick="this.closest('.modal-overlay').style.display='none'">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
          
          <form class="submit-form" id="submitForm">
            <div class="form-group">
              <label for="promptTitle">Title *</label>
              <input type="text" id="promptTitle" name="title" required maxlength="255" 
                     placeholder="Enter a clear, descriptive title">
              <div class="form-help">Be specific and descriptive</div>
            </div>

            <div class="form-group">
              <label for="promptContent">Prompt Content *</label>
              <textarea id="promptContent" name="content" required maxlength="10000" rows="8"
                        placeholder="Write your prompt here. Be clear about what you want the AI to do..."></textarea>
              <div class="form-help">This is the actual prompt text that users will copy</div>
            </div>

            <div class="form-group">
              <label for="promptDescription">Description</label>
              <textarea id="promptDescription" name="description" maxlength="500" rows="3"
                        placeholder="Brief description of what this prompt does (optional)"></textarea>
              <div class="form-help">Help others understand when to use this prompt</div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="promptCategory">Category *</label>
                <select id="promptCategory" name="category" required>
                  <option value="">Select a category</option>
                  <option value="development">Development</option>
                  <option value="creative">Creative</option>
                  <option value="business">Business</option>
                  <option value="education">Education</option>
                  <option value="research">Research</option>
                  <option value="technical">Technical</option>
                </select>
              </div>

              <div class="form-group">
                <label for="promptDifficulty">Difficulty Level</label>
                <select id="promptDifficulty" name="difficulty_level">
                  <option value="beginner">Beginner</option>
                  <option value="intermediate" selected>Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label for="promptTags">Tags</label>
              <input type="text" id="promptTags" name="tags" 
                     placeholder="Enter tags separated by commas (e.g., ai, coding, productivity)">
              <div class="form-help">Use relevant keywords to help others find your prompt</div>
            </div>

            <div class="form-actions">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('submitModal').style.display='none'">
                Cancel
              </button>
              <button type="submit" class="btn btn-primary">
                Submit Prompt
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Handle form submission
    document.getElementById('submitForm').addEventListener('submit', this.handleSubmitForm.bind(this));

    // Handle submit button clicks
    document.querySelectorAll('a[href="#submit"], button[onclick*="submit"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('submitModal').style.display = 'flex';
      });
    });
  }

  async handleSubmitForm(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData.entries());
    
    // Parse tags
    if (data.tags) {
      data.tags = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    try {
      const response = await fetch('/api/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to submit prompt');
      }

      const result = await response.json();
      
      this.showToast('Prompt submitted successfully!', 'success');
      document.getElementById('submitModal').style.display = 'none';
      e.target.reset();
      
      // Refresh prompts to show the new one
      await this.loadPrompts();
      
    } catch (error) {
      console.error('Failed to submit prompt:', error);
      this.showToast(error.message || 'Failed to submit prompt', 'error');
    }
  }

  updateStats() {
    const promptCount = document.getElementById('promptCount');
    if (promptCount && this.prompts.length > 0) {
      promptCount.textContent = `${this.prompts.length.toLocaleString()}+`;
    }
  }

  updateResultsInfo() {
    const resultsInfo = document.getElementById('resultsInfo');
    const resultsCount = document.getElementById('resultsCount');
    
    if (!resultsInfo || !resultsCount) return;

    if (this.filters.search || this.filters.category !== 'all') {
      resultsInfo.style.display = 'flex';
      resultsCount.textContent = this.pagination.total || this.prompts.length;
    } else {
      resultsInfo.style.display = 'none';
    }
  }

  showLoading(show) {
    const grid = document.getElementById('promptsGrid');
    if (!grid) return;

    if (show) {
      grid.innerHTML = `
        <div class="prompt-card loading" style="grid-column: 1 / -1;">
          <div style="height: 200px; display: flex; align-items: center; justify-content: center; color: var(--text-secondary);">
            Loading amazing prompts...
          </div>
        </div>
      `;
    }
  }

  showError(message) {
    const grid = document.getElementById('promptsGrid');
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-secondary);">
          <div style="font-size: 2rem; margin-bottom: 1rem;">⚠️</div>
          <div>${message}</div>
          <button onclick="window.promptApp.loadPrompts()" style="margin-top: 1rem;" class="btn btn-primary">
            Try Again
          </button>
        </div>
      `;
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer') || this.createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    
    toast.innerHTML = `
      <div class="toast-icon">${icon}</div>
      <div class="toast-content">
        <div class="toast-title">${message}</div>
      </div>
      <button class="toast-close">×</button>
    `;
    
    container.appendChild(toast);
    
    // Show toast
    requestAnimationFrame(() => toast.classList.add('show'));
    
    // Auto-hide
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 4000);
    
    // Close button
    toast.querySelector('.toast-close').addEventListener('click', () => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    });
  }

  createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toastContainer';
    container.style.cssText = `
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    `;
    document.body.appendChild(container);
    return container;
  }

  loadFavorites() {
    try {
      return JSON.parse(localStorage.getItem('prompthero_favorites') || '[]');
    } catch {
      return [];
    }
  }

  saveFavorites() {
    try {
      localStorage.setItem('prompthero_favorites', JSON.stringify(this.favorites));
    } catch (error) {
      console.error('Failed to save favorites:', error);
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
}

// Utility functions
function scrollToSearch() {
  const element = document.getElementById('browse');
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  window.promptApp = new PromptApp();
});

// Service Worker for offline functionality (optional)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => console.log('SW registered'))
      .catch(registrationError => console.log('SW registration failed'));
  });
}
