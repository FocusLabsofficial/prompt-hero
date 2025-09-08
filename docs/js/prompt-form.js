// Prompt Submission Form Manager
class PromptFormManager {
    constructor() {
        this.form = null;
        this.isSubmitting = false;
        this.init();
    }

    init() {
        this.createForm();
        this.setupEventListeners();
    }

    // Create the prompt submission form
    createForm() {
        const formHTML = `
            <div class="prompt-form-modal" id="promptFormModal" style="display: none;">
                <div class="modal-overlay" onclick="this.closest('.prompt-form-modal').style.display='none'"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Submit a New Prompt</h3>
                        <button class="modal-close" onclick="document.getElementById('promptFormModal').style.display='none'">×</button>
                    </div>
                    <form class="prompt-form" id="promptForm">
                        <div class="form-group">
                            <label for="promptTitle">Title *</label>
                            <input 
                                type="text" 
                                id="promptTitle" 
                                name="title" 
                                required 
                                maxlength="255"
                                placeholder="Enter a descriptive title for your prompt"
                            >
                            <div class="char-count">
                                <span id="titleCount">0</span>/255
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="promptContent">Prompt Content *</label>
                            <textarea 
                                id="promptContent" 
                                name="content" 
                                required 
                                maxlength="10000"
                                rows="8"
                                placeholder="Write your prompt here. Be specific and clear about what you want the AI to do..."
                            ></textarea>
                            <div class="char-count">
                                <span id="contentCount">0</span>/10,000
                            </div>
                        </div>

                        <div class="form-group">
                            <label for="promptDescription">Description</label>
                            <textarea 
                                id="promptDescription" 
                                name="description" 
                                maxlength="500"
                                rows="3"
                                placeholder="Brief description of what this prompt does (optional)"
                            ></textarea>
                            <div class="char-count">
                                <span id="descriptionCount">0</span>/500
                            </div>
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
                            <input 
                                type="text" 
                                id="promptTags" 
                                name="tags" 
                                placeholder="Enter tags separated by commas (e.g., ai, coding, productivity)"
                            >
                            <div class="form-help">Separate multiple tags with commas</div>
                        </div>

                        <div class="form-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="promptPublic" name="is_public" checked>
                                <span class="checkmark"></span>
                                Make this prompt public
                            </label>
                            <div class="form-help">Public prompts can be discovered and used by other users</div>
                        </div>

                        <div class="form-actions">
                            <button type="button" class="btn-secondary" onclick="document.getElementById('promptFormModal').style.display='none'">
                                Cancel
                            </button>
                            <button type="submit" class="btn-primary" id="submitBtn">
                                <span class="btn-text">Submit Prompt</span>
                                <span class="btn-loading" style="display: none;">
                                    <span class="spinner"></span>
                                    Submitting...
                                </span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        // Add form to page
        document.body.insertAdjacentHTML('beforeend', formHTML);
        this.form = document.getElementById('promptForm');
    }

    // Setup event listeners
    setupEventListeners() {
        // Character count updates
        this.setupCharacterCounters();
        
        // Form submission
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        // Real-time validation
        this.setupValidation();
    }

    // Setup character counters
    setupCharacterCounters() {
        const titleInput = document.getElementById('promptTitle');
        const contentInput = document.getElementById('promptContent');
        const descriptionInput = document.getElementById('promptDescription');

        titleInput.addEventListener('input', () => {
            const count = titleInput.value.length;
            document.getElementById('titleCount').textContent = count;
            this.updateCharCountStyle('titleCount', count, 255);
        });

        contentInput.addEventListener('input', () => {
            const count = contentInput.value.length;
            document.getElementById('contentCount').textContent = count;
            this.updateCharCountStyle('contentCount', count, 10000);
        });

        descriptionInput.addEventListener('input', () => {
            const count = descriptionInput.value.length;
            document.getElementById('descriptionCount').textContent = count;
            this.updateCharCountStyle('descriptionCount', count, 500);
        });
    }

    // Update character count styling
    updateCharCountStyle(elementId, count, max) {
        const element = document.getElementById(elementId);
        const percentage = (count / max) * 100;
        
        if (percentage >= 90) {
            element.style.color = 'var(--error-color)';
        } else if (percentage >= 75) {
            element.style.color = 'var(--warning-color)';
        } else {
            element.style.color = 'var(--text-secondary)';
        }
    }

    // Setup real-time validation
    setupValidation() {
        const inputs = this.form.querySelectorAll('input, textarea, select');
        
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input));
        });
    }

    // Validate individual field
    validateField(field) {
        const value = field.value.trim();
        const fieldName = field.name;
        let isValid = true;
        let errorMessage = '';

        // Required field validation
        if (field.required && !value) {
            isValid = false;
            errorMessage = `${this.getFieldLabel(fieldName)} is required`;
        }

        // Specific field validations
        switch (fieldName) {
            case 'title':
                if (value && value.length < 10) {
                    isValid = false;
                    errorMessage = 'Title must be at least 10 characters long';
                }
                break;
            case 'content':
                if (value && value.length < 50) {
                    isValid = false;
                    errorMessage = 'Content must be at least 50 characters long';
                }
                break;
            case 'category':
                if (value && !['development', 'creative', 'business', 'education', 'research', 'technical'].includes(value)) {
                    isValid = false;
                    errorMessage = 'Please select a valid category';
                }
                break;
        }

        this.setFieldError(field, isValid, errorMessage);
        return isValid;
    }

    // Set field error state
    setFieldError(field, isValid, message) {
        const fieldGroup = field.closest('.form-group');
        const existingError = fieldGroup.querySelector('.field-error');
        
        if (existingError) {
            existingError.remove();
        }

        if (!isValid) {
            field.classList.add('error');
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.textContent = message;
            fieldGroup.appendChild(errorDiv);
        } else {
            field.classList.remove('error');
        }
    }

    // Clear field error
    clearFieldError(field) {
        field.classList.remove('error');
        const fieldGroup = field.closest('.form-group');
        const existingError = fieldGroup.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }

    // Get field label
    getFieldLabel(fieldName) {
        const labels = {
            title: 'Title',
            content: 'Content',
            description: 'Description',
            category: 'Category',
            difficulty_level: 'Difficulty Level',
            tags: 'Tags'
        };
        return labels[fieldName] || fieldName;
    }

    // Handle form submission
    async handleSubmit(event) {
        event.preventDefault();
        
        if (this.isSubmitting) return;

        // Validate all fields
        const inputs = this.form.querySelectorAll('input, textarea, select');
        let isFormValid = true;

        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isFormValid = false;
            }
        });

        if (!isFormValid) {
            this.showNotification('Please fix the errors above', 'error');
            return;
        }

        this.isSubmitting = true;
        this.setSubmitButtonState(true);

        try {
            const formData = new FormData(this.form);
            const promptData = {
                title: formData.get('title').trim(),
                content: formData.get('content').trim(),
                description: formData.get('description').trim(),
                category: formData.get('category'),
                difficulty_level: formData.get('difficulty_level'),
                tags: this.parseTags(formData.get('tags')),
                is_public: formData.get('is_public') === 'on'
            };

            // Submit to API
            const response = await fetch('/api/prompts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(promptData)
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification('Prompt submitted successfully!', 'success');
                this.resetForm();
                this.closeForm();
                
                // Refresh prompts if prompt manager exists
                if (window.promptManager) {
                    window.promptManager.loadPrompts().then(prompts => {
                        window.promptManager.renderPrompts(prompts);
                    });
                }
            } else {
                throw new Error(result.error || 'Failed to submit prompt');
            }

        } catch (error) {
            console.error('Error submitting prompt:', error);
            this.showNotification(error.message || 'Failed to submit prompt', 'error');
        } finally {
            this.isSubmitting = false;
            this.setSubmitButtonState(false);
        }
    }

    // Parse tags from comma-separated string
    parseTags(tagsString) {
        if (!tagsString) return [];
        
        return tagsString
            .split(',')
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0)
            .slice(0, 10); // Limit to 10 tags
    }

    // Set submit button state
    setSubmitButtonState(isLoading) {
        const submitBtn = document.getElementById('submitBtn');
        const btnText = submitBtn.querySelector('.btn-text');
        const btnLoading = submitBtn.querySelector('.btn-loading');

        if (isLoading) {
            submitBtn.disabled = true;
            btnText.style.display = 'none';
            btnLoading.style.display = 'inline-flex';
        } else {
            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoading.style.display = 'none';
        }
    }

    // Reset form
    resetForm() {
        this.form.reset();
        
        // Reset character counts
        document.getElementById('titleCount').textContent = '0';
        document.getElementById('contentCount').textContent = '0';
        document.getElementById('descriptionCount').textContent = '0';
        
        // Clear all errors
        const inputs = this.form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => this.clearFieldError(input));
    }

    // Close form
    closeForm() {
        document.getElementById('promptFormModal').style.display = 'none';
    }

    // Show form
    showForm() {
        document.getElementById('promptFormModal').style.display = 'flex';
        document.getElementById('promptTitle').focus();
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
}

// Global function to show prompt form
function showPromptForm() {
    if (!window.promptFormManager) {
        window.promptFormManager = new PromptFormManager();
    }
    window.promptFormManager.showForm();
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Create form manager instance
    window.promptFormManager = new PromptFormManager();
    
    // Update submit prompt button in header
    const submitBtn = document.querySelector('a[href="#submit"]');
    if (submitBtn) {
        submitBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showPromptForm();
        });
    }
});
