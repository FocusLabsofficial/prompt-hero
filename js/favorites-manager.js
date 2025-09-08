// Favorites Manager for Prompt Hero
class FavoritesManager {
    constructor() {
        this.favorites = [];
        this.collections = [];
        this.currentUser = null;
        this.init();
    }

    init() {
        this.loadFavoritesFromStorage();
        this.loadCollectionsFromStorage();
        this.updateFavoritesUI();
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
        // Listen for favorite button clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('favorite-btn') || e.target.closest('.favorite-btn')) {
                const button = e.target.classList.contains('favorite-btn') ? e.target : e.target.closest('.favorite-btn');
                const promptId = button.dataset.promptId;
                if (promptId) {
                    this.toggleFavorite(promptId);
                }
            }
        });

        // Listen for collection button clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('add-to-collection-btn')) {
                const promptId = e.target.dataset.promptId;
                if (promptId) {
                    this.showCollectionModal(promptId);
                }
            }
        });
    }

    // Toggle favorite status
    async toggleFavorite(promptId) {
        const isFavorited = this.favorites.includes(promptId);
        
        try {
            if (isFavorited) {
                // Remove from favorites
                this.favorites = this.favorites.filter(id => id !== promptId);
                this.showNotification('Removed from favorites', 'info');
                
                // Update API if user is logged in
                if (this.currentUser) {
                    await this.removeFavoriteFromAPI(promptId);
                }
            } else {
                // Add to favorites
                this.favorites.push(promptId);
                this.showNotification('Added to favorites', 'success');
                
                // Update API if user is logged in
                if (this.currentUser) {
                    await this.addFavoriteToAPI(promptId);
                }
            }
            
            this.saveFavoritesToStorage();
            this.updateFavoriteButtons();
            this.updateFavoritesUI();
            
        } catch (error) {
            console.error('Error toggling favorite:', error);
            this.showNotification('Failed to update favorites', 'error');
        }
    }

    // Add favorite to API
    async addFavoriteToAPI(promptId) {
        const response = await fetch('/api/favorites', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: this.currentUser.id,
                prompt_id: promptId
            })
        });

        if (!response.ok) {
            throw new Error('Failed to add favorite');
        }
    }

    // Remove favorite from API
    async removeFavoriteFromAPI(promptId) {
        const response = await fetch(`/api/favorites?user_id=${this.currentUser.id}&prompt_id=${promptId}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error('Failed to remove favorite');
        }
    }

    // Check if prompt is favorited
    isFavorited(promptId) {
        return this.favorites.includes(promptId);
    }

    // Update favorite buttons
    updateFavoriteButtons() {
        document.querySelectorAll('.favorite-btn').forEach(button => {
            const promptId = button.dataset.promptId;
            if (promptId) {
                const isFavorited = this.isFavorited(promptId);
                button.textContent = isFavorited ? '❤️' : '🤍';
                button.classList.toggle('favorited', isFavorited);
                button.title = isFavorited ? 'Remove from favorites' : 'Add to favorites';
            }
        });
    }

    // Update favorites UI
    updateFavoritesUI() {
        const favoritesCount = this.favorites.length;
        
        // Update favorites badge in header
        const favoritesBadge = document.getElementById('favoritesBadge');
        if (favoritesBadge) {
            favoritesBadge.textContent = favoritesCount;
            favoritesBadge.style.display = favoritesCount > 0 ? 'block' : 'none';
        }

        // Update favorites button text
        const favoritesButton = document.querySelector('a[href="#favorites"]');
        if (favoritesButton) {
            const text = favoritesButton.querySelector('.btn-text');
            if (text) {
                text.textContent = `Favorites (${favoritesCount})`;
            }
        }
    }

    // Show collection modal
    showCollectionModal(promptId) {
        const modal = document.createElement('div');
        modal.className = 'collection-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Add to Collection</h3>
                    <button class="modal-close" onclick="this.closest('.collection-modal').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="collection-list" id="collectionList">
                        ${this.renderCollectionList(promptId)}
                    </div>
                    <div class="create-collection-section">
                        <h4>Create New Collection</h4>
                        <form class="create-collection-form" onsubmit="event.preventDefault(); window.favoritesManager.createCollection(event, '${promptId}')">
                            <input type="text" name="name" placeholder="Collection name" required>
                            <textarea name="description" placeholder="Description (optional)" rows="2"></textarea>
                            <button type="submit">Create & Add</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    // Render collection list
    renderCollectionList(promptId) {
        if (this.collections.length === 0) {
            return '<p class="no-collections">No collections yet. Create your first one below!</p>';
        }

        return this.collections.map(collection => {
            const hasPrompt = collection.prompts && collection.prompts.includes(promptId);
            return `
                <div class="collection-item ${hasPrompt ? 'has-prompt' : ''}">
                    <div class="collection-info">
                        <h4>${this.escapeHtml(collection.name)}</h4>
                        <p>${this.escapeHtml(collection.description || '')}</p>
                        <span class="prompt-count">${collection.prompts ? collection.prompts.length : 0} prompts</span>
                    </div>
                    <button 
                        class="collection-action-btn ${hasPrompt ? 'remove' : 'add'}"
                        onclick="window.favoritesManager.togglePromptInCollection('${collection.id}', '${promptId}')"
                    >
                        ${hasPrompt ? 'Remove' : 'Add'}
                    </button>
                </div>
            `;
        }).join('');
    }

    // Toggle prompt in collection
    togglePromptInCollection(collectionId, promptId) {
        const collection = this.collections.find(c => c.id === collectionId);
        if (!collection) return;

        if (!collection.prompts) {
            collection.prompts = [];
        }

        const hasPrompt = collection.prompts.includes(promptId);
        
        if (hasPrompt) {
            collection.prompts = collection.prompts.filter(id => id !== promptId);
            this.showNotification('Removed from collection', 'info');
        } else {
            collection.prompts.push(promptId);
            this.showNotification('Added to collection', 'success');
        }

        this.saveCollectionsToStorage();
        
        // Update the collection list in the modal
        const collectionList = document.getElementById('collectionList');
        if (collectionList) {
            collectionList.innerHTML = this.renderCollectionList(promptId);
        }
    }

    // Create new collection
    createCollection(event, promptId) {
        const formData = new FormData(event.target);
        const name = formData.get('name').trim();
        const description = formData.get('description').trim();

        if (!name) {
            this.showNotification('Collection name is required', 'error');
            return;
        }

        const newCollection = {
            id: this.generateId(),
            name: name,
            description: description,
            prompts: [promptId],
            created_at: new Date().toISOString(),
            is_public: true
        };

        this.collections.push(newCollection);
        this.saveCollectionsToStorage();
        
        this.showNotification('Collection created and prompt added!', 'success');
        
        // Close modal
        const modal = event.target.closest('.collection-modal');
        if (modal) {
            modal.remove();
        }
    }

    // Get favorites
    getFavorites() {
        return this.favorites;
    }

    // Get collections
    getCollections() {
        return this.collections;
    }

    // Generate unique ID
    generateId() {
        return Math.random().toString(36).substr(2, 9);
    }

    // Escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show notification
    showNotification(message, type = 'info') {
        if (window.promptManager && window.promptManager.showNotification) {
            window.promptManager.showNotification(message, type);
        } else {
            // Fallback notification
            const notification = document.createElement('div');
            notification.className = `notification ${type}`;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            setTimeout(() => notification.classList.add('show'), 100);
            setTimeout(() => {
                notification.classList.remove('show');
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    }

    // Set current user
    setCurrentUser(user) {
        this.currentUser = user;
    }

    // Load favorites from API
    async loadFavoritesFromAPI() {
        if (!this.currentUser) return;

        try {
            const response = await fetch(`/api/favorites?user_id=${this.currentUser.id}`);
            if (response.ok) {
                const data = await response.json();
                this.favorites = data.favorites.map(fav => fav.prompt_id);
                this.saveFavoritesToStorage();
                this.updateFavoriteButtons();
                this.updateFavoritesUI();
            }
        } catch (error) {
            console.error('Error loading favorites from API:', error);
        }
    }

    // Load collections from API
    async loadCollectionsFromAPI() {
        if (!this.currentUser) return;

        try {
            const response = await fetch(`/api/collections?user_id=${this.currentUser.id}`);
            if (response.ok) {
                const data = await response.json();
                this.collections = data.collections;
                this.saveCollectionsToStorage();
            }
        } catch (error) {
            console.error('Error loading collections from API:', error);
        }
    }
}

// Initialize Favorites Manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.favoritesManager = new FavoritesManager();
    
    // Update favorite buttons after prompts are loaded
    if (window.promptManager) {
        window.promptManager.loadPrompts().then(() => {
            window.favoritesManager.updateFavoriteButtons();
        });
    }
});
