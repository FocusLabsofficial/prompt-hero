// Authentication Manager for Prompt Hero
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.token = null;
        this.isAuthenticated = false;
        this.init();
    }

    init() {
        // Load user data from localStorage on initialization
        this.loadUserFromStorage();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Listen for auth state changes
        document.addEventListener('authStateChanged', (event) => {
            this.handleAuthStateChange(event.detail);
        });
    }

    loadUserFromStorage() {
        try {
            const storedUser = localStorage.getItem('promptHero_user');
            const storedToken = localStorage.getItem('promptHero_token');
            
            if (storedUser && storedToken) {
                this.currentUser = JSON.parse(storedUser);
                this.token = storedToken;
                this.isAuthenticated = true;
                this.updateUI();
            }
        } catch (error) {
            console.error('Error loading user from storage:', error);
            this.logout();
        }
    }

    async register(userData) {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(userData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            // Store user data and token
            this.currentUser = data.user;
            this.token = data.token;
            this.isAuthenticated = true;
            
            this.saveUserToStorage();
            this.updateUI();
            this.dispatchAuthEvent('registered', data.user);

            return { success: true, user: data.user };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    }

    async login(credentials) {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(credentials)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            // Store user data and token
            this.currentUser = data.user;
            this.token = data.token;
            this.isAuthenticated = true;
            
            this.saveUserToStorage();
            this.updateUI();
            this.dispatchAuthEvent('loggedIn', data.user);

            return { success: true, user: data.user };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    }

    async logout() {
        try {
            // Clear stored data
            localStorage.removeItem('promptHero_user');
            localStorage.removeItem('promptHero_token');
            
            // Reset state
            const previousUser = this.currentUser;
            this.currentUser = null;
            this.token = null;
            this.isAuthenticated = false;
            
            this.updateUI();
            this.dispatchAuthEvent('loggedOut', previousUser);

            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    }

    async verifyToken() {
        if (!this.token) {
            return { success: false, error: 'No token available' };
        }

        try {
            const response = await fetch('/api/auth/verify', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                // Token is invalid, logout user
                this.logout();
                return { success: false, error: data.error || 'Token verification failed' };
            }

            // Update user data with fresh data from server
            this.currentUser = data.user;
            this.saveUserToStorage();
            this.updateUI();

            return { success: true, user: data.user };
        } catch (error) {
            console.error('Token verification error:', error);
            this.logout();
            return { success: false, error: error.message };
        }
    }

    saveUserToStorage() {
        try {
            localStorage.setItem('promptHero_user', JSON.stringify(this.currentUser));
            localStorage.setItem('promptHero_token', this.token);
        } catch (error) {
            console.error('Error saving user to storage:', error);
        }
    }

    updateUI() {
        // Update authentication UI elements
        const authElements = document.querySelectorAll('[data-auth]');
        authElements.forEach(element => {
            const authState = element.getAttribute('data-auth');
            if (authState === 'authenticated') {
                element.style.display = this.isAuthenticated ? 'block' : 'none';
            } else if (authState === 'unauthenticated') {
                element.style.display = this.isAuthenticated ? 'none' : 'block';
            }
        });

        // Update user info elements
        if (this.isAuthenticated && this.currentUser) {
            const userElements = document.querySelectorAll('[data-user]');
            userElements.forEach(element => {
                const userField = element.getAttribute('data-user');
                if (this.currentUser[userField]) {
                    element.textContent = this.currentUser[userField];
                }
            });

            // Update user avatar
            const avatarElements = document.querySelectorAll('[data-user-avatar]');
            avatarElements.forEach(element => {
                if (this.currentUser.avatar_url) {
                    element.src = this.currentUser.avatar_url;
                    element.alt = `${this.currentUser.display_name || this.currentUser.username}'s avatar`;
                } else {
                    // Generate default avatar
                    element.src = this.generateDefaultAvatar(this.currentUser.username);
                    element.alt = `${this.currentUser.username}'s avatar`;
                }
            });
        }
    }

    generateDefaultAvatar(username) {
        // Generate a simple avatar using a service like Gravatar or create a colored circle
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8'];
        const colorIndex = username.charCodeAt(0) % colors.length;
        const color = colors[colorIndex];
        const initial = username.charAt(0).toUpperCase();
        
        // Create a data URL for a simple colored circle with initial
        const canvas = document.createElement('canvas');
        canvas.width = 40;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        
        // Draw circle
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(20, 20, 20, 0, 2 * Math.PI);
        ctx.fill();
        
        // Draw initial
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initial, 20, 20);
        
        return canvas.toDataURL();
    }

    dispatchAuthEvent(eventType, user) {
        const event = new CustomEvent('authStateChanged', {
            detail: {
                type: eventType,
                user: user,
                isAuthenticated: this.isAuthenticated
            }
        });
        document.dispatchEvent(event);
    }

    handleAuthStateChange(detail) {
        // Handle auth state changes from other parts of the app
        if (detail.type === 'logout') {
            this.logout();
        }
    }

    getCurrentUser() {
        return this.currentUser;
    }

    getToken() {
        return this.token;
    }

    isUserAuthenticated() {
        return this.isAuthenticated;
    }

    // Utility method to make authenticated API requests
    async authenticatedFetch(url, options = {}) {
        if (!this.isAuthenticated || !this.token) {
            throw new Error('User not authenticated');
        }

        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        };

        return fetch(url, { ...options, ...defaultOptions });
    }
}

// Global auth manager instance
window.authManager = new AuthManager();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
