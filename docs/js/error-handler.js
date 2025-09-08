// Comprehensive Error Handling and User Feedback System
class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
        this.init();
    }

    init() {
        this.setupGlobalErrorHandlers();
        this.setupNetworkErrorHandling();
        this.setupValidationErrors();
    }

    // Setup global error handlers
    setupGlobalErrorHandlers() {
        // Global JavaScript error handler
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack,
                timestamp: new Date().toISOString()
            });
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'promise',
                message: event.reason?.message || 'Unhandled promise rejection',
                stack: event.reason?.stack,
                timestamp: new Date().toISOString()
            });
        });

        // Resource loading error handler
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.handleError({
                    type: 'resource',
                    message: `Failed to load resource: ${event.target.src || event.target.href}`,
                    element: event.target.tagName,
                    timestamp: new Date().toISOString()
                });
            }
        }, true);
    }

    // Setup network error handling
    setupNetworkErrorHandling() {
        // Intercept fetch requests
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                const response = await originalFetch(...args);
                
                if (!response.ok) {
                    this.handleError({
                        type: 'network',
                        message: `HTTP ${response.status}: ${response.statusText}`,
                        url: args[0],
                        status: response.status,
                        timestamp: new Date().toISOString()
                    });
                }
                
                return response;
            } catch (error) {
                this.handleError({
                    type: 'network',
                    message: error.message,
                    url: args[0],
                    timestamp: new Date().toISOString()
                });
                throw error;
            }
        };
    }

    // Setup validation error handling
    setupValidationErrors() {
        // Form validation errors
        document.addEventListener('invalid', (event) => {
            const field = event.target;
            this.showFieldError(field, field.validationMessage);
        }, true);

        // Custom validation for prompt forms
        document.addEventListener('input', (event) => {
            if (event.target.closest('.prompt-form')) {
                this.clearFieldError(event.target);
            }
        });
    }

    // Main error handling method
    handleError(errorInfo) {
        // Log error
        this.logError(errorInfo);

        // Show user-friendly message
        this.showUserError(errorInfo);

        // Report to analytics (if available)
        this.reportError(errorInfo);
    }

    // Log error to internal storage
    logError(errorInfo) {
        this.errorLog.unshift(errorInfo);
        
        // Keep log size manageable
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(0, this.maxLogSize);
        }

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error('Error logged:', errorInfo);
        }
    }

    // Show user-friendly error message
    showUserError(errorInfo) {
        const userMessage = this.getUserFriendlyMessage(errorInfo);
        const type = this.getErrorType(errorInfo);
        
        this.showNotification(userMessage, type);
    }

    // Get user-friendly error message
    getUserFriendlyMessage(errorInfo) {
        switch (errorInfo.type) {
            case 'network':
                if (errorInfo.status === 404) {
                    return 'The requested resource was not found. Please try again.';
                } else if (errorInfo.status === 403) {
                    return 'You don\'t have permission to access this resource.';
                } else if (errorInfo.status === 500) {
                    return 'Server error occurred. Please try again later.';
                } else if (errorInfo.status >= 400) {
                    return 'Request failed. Please check your connection and try again.';
                } else {
                    return 'Network error occurred. Please check your connection.';
                }
            
            case 'javascript':
                return 'An unexpected error occurred. Please refresh the page and try again.';
            
            case 'promise':
                return 'An operation failed. Please try again.';
            
            case 'resource':
                return 'Failed to load a resource. Some features may not work properly.';
            
            case 'validation':
                return errorInfo.message || 'Please check your input and try again.';
            
            default:
                return 'An unexpected error occurred. Please try again.';
        }
    }

    // Get error type for notification
    getErrorType(errorInfo) {
        switch (errorInfo.type) {
            case 'network':
                return errorInfo.status >= 500 ? 'error' : 'warning';
            case 'javascript':
            case 'promise':
                return 'error';
            case 'resource':
                return 'warning';
            case 'validation':
                return 'warning';
            default:
                return 'error';
        }
    }

    // Show notification
    showNotification(message, type = 'error') {
        // Use existing notification system if available
        if (window.promptManager && window.promptManager.showNotification) {
            window.promptManager.showNotification(message, type);
            return;
        }

        // Fallback notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${this.getNotificationIcon(type)}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Show notification
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto-hide after delay
        const delay = type === 'error' ? 5000 : 3000;
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, delay);
    }

    // Get notification icon
    getNotificationIcon(type) {
        const icons = {
            error: '❌',
            warning: '⚠️',
            success: '✅',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }

    // Show field-specific error
    showFieldError(field, message) {
        const fieldGroup = field.closest('.form-group');
        if (!fieldGroup) return;

        // Remove existing error
        this.clearFieldError(field);

        // Add error class
        field.classList.add('error');

        // Add error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        fieldGroup.appendChild(errorDiv);

        // Focus field
        field.focus();
    }

    // Clear field error
    clearFieldError(field) {
        field.classList.remove('error');
        const fieldGroup = field.closest('.form-group');
        if (fieldGroup) {
            const existingError = fieldGroup.querySelector('.field-error');
            if (existingError) {
                existingError.remove();
            }
        }
    }

    // Report error to analytics
    reportError(errorInfo) {
        // Report to analytics service if available
        if (window.gtag) {
            window.gtag('event', 'exception', {
                description: errorInfo.message,
                fatal: errorInfo.type === 'javascript' || errorInfo.type === 'promise'
            });
        }

        // Report to custom analytics
        if (window.promptManager && window.promptManager.trackEvent) {
            window.promptManager.trackEvent('error', null, {
                error_type: errorInfo.type,
                error_message: errorInfo.message,
                error_url: errorInfo.url || window.location.href
            });
        }
    }

    // Get error log
    getErrorLog() {
        return this.errorLog;
    }

    // Clear error log
    clearErrorLog() {
        this.errorLog = [];
    }

    // Handle API errors specifically
    handleAPIError(response, context = '') {
        const errorInfo = {
            type: 'api',
            message: `API Error: ${response.status} ${response.statusText}`,
            status: response.status,
            context: context,
            timestamp: new Date().toISOString()
        };

        this.handleError(errorInfo);
    }

    // Handle validation errors
    handleValidationError(field, message) {
        this.handleError({
            type: 'validation',
            message: message,
            field: field.name || field.id,
            timestamp: new Date().toISOString()
        });
    }

    // Retry mechanism for failed operations
    async retryOperation(operation, maxRetries = 3, delay = 1000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                if (attempt === maxRetries) {
                    throw error;
                }
                
                // Wait before retrying
                await new Promise(resolve => setTimeout(resolve, delay * attempt));
                
                this.showNotification(`Retrying... (${attempt}/${maxRetries})`, 'info');
            }
        }
    }

    // Show loading state
    showLoading(element, message = 'Loading...') {
        if (element) {
            element.disabled = true;
            element.dataset.originalText = element.textContent;
            element.innerHTML = `
                <span class="spinner"></span>
                ${message}
            `;
        }
    }

    // Hide loading state
    hideLoading(element) {
        if (element && element.dataset.originalText) {
            element.disabled = false;
            element.textContent = element.dataset.originalText;
            delete element.dataset.originalText;
        }
    }

    // Show success message
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    // Show warning message
    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    // Show info message
    showInfo(message) {
        this.showNotification(message, 'info');
    }
}

// Initialize Error Handler when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.errorHandler = new ErrorHandler();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}
