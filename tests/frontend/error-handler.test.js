// Frontend Tests for Error Handler
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JSDOM } from 'jsdom';

// Mock DOM environment
const dom = new JSDOM(`
<!DOCTYPE html>
<html>
<head></head>
<body>
    <div id="notificationContainer"></div>
</body>
</html>
`, {
    url: 'http://localhost',
    pretendToBeVisual: true,
    resources: 'usable'
});

global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;

// Mock console methods
global.console = {
    ...console,
    log: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
};

describe('ErrorHandler', () => {
    let ErrorHandler;

    beforeEach(async () => {
        // Clear all mocks
        vi.clearAllMocks();
        
        // Clear notification container
        document.getElementById('notificationContainer').innerHTML = '';
        
        // Dynamically import ErrorHandler after setting up mocks
        const module = await import('../../docs/js/error-handler.js');
        ErrorHandler = module.default;
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('Initialization', () => {
        it('should initialize with empty notification stack', () => {
            const handler = new ErrorHandler();
            expect(handler.notifications).toEqual([]);
        });

        it('should create notification container if it does not exist', () => {
            // Remove existing container
            const container = document.getElementById('notificationContainer');
            container.remove();
            
            const handler = new ErrorHandler();
            const newContainer = document.getElementById('notificationContainer');
            
            expect(newContainer).toBeTruthy();
            expect(newContainer.className).toBe('notification-stack');
        });
    });

    describe('Success Notifications', () => {
        let handler;

        beforeEach(() => {
            handler = new ErrorHandler();
        });

        it('should show success notification', () => {
            handler.showSuccess('Operation completed successfully');
            
            const container = document.getElementById('notificationContainer');
            const notification = container.querySelector('.notification.success');
            
            expect(notification).toBeTruthy();
            expect(notification.textContent).toContain('Operation completed successfully');
            expect(notification.querySelector('.notification-icon').textContent).toBe('✅');
        });

        it('should auto-dismiss success notification after 3 seconds', async () => {
            vi.useFakeTimers();
            
            handler.showSuccess('Test message');
            
            const container = document.getElementById('notificationContainer');
            let notification = container.querySelector('.notification.success');
            expect(notification).toBeTruthy();
            
            // Fast-forward time
            vi.advanceTimersByTime(3000);
            await new Promise(resolve => setTimeout(resolve, 0));
            
            notification = container.querySelector('.notification.success');
            expect(notification).toBeFalsy();
            
            vi.useRealTimers();
        });

        it('should allow manual dismissal of success notification', () => {
            handler.showSuccess('Test message');
            
            const container = document.getElementById('notificationContainer');
            const notification = container.querySelector('.notification.success');
            const closeBtn = notification.querySelector('.notification-close');
            
            closeBtn.click();
            
            const remainingNotification = container.querySelector('.notification.success');
            expect(remainingNotification).toBeFalsy();
        });
    });

    describe('Error Notifications', () => {
        let handler;

        beforeEach(() => {
            handler = new ErrorHandler();
        });

        it('should show error notification', () => {
            handler.showError('Something went wrong');
            
            const container = document.getElementById('notificationContainer');
            const notification = container.querySelector('.notification.error');
            
            expect(notification).toBeTruthy();
            expect(notification.textContent).toContain('Something went wrong');
            expect(notification.querySelector('.notification-icon').textContent).toBe('❌');
        });

        it('should not auto-dismiss error notifications', async () => {
            vi.useFakeTimers();
            
            handler.showError('Test error');
            
            const container = document.getElementById('notificationContainer');
            let notification = container.querySelector('.notification.error');
            expect(notification).toBeTruthy();
            
            // Fast-forward time
            vi.advanceTimersByTime(10000);
            await new Promise(resolve => setTimeout(resolve, 0));
            
            notification = container.querySelector('.notification.error');
            expect(notification).toBeTruthy();
            
            vi.useRealTimers();
        });

        it('should allow manual dismissal of error notification', () => {
            handler.showError('Test error');
            
            const container = document.getElementById('notificationContainer');
            const notification = container.querySelector('.notification.error');
            const closeBtn = notification.querySelector('.notification-close');
            
            closeBtn.click();
            
            const remainingNotification = container.querySelector('.notification.error');
            expect(remainingNotification).toBeFalsy();
        });
    });

    describe('Warning Notifications', () => {
        let handler;

        beforeEach(() => {
            handler = new ErrorHandler();
        });

        it('should show warning notification', () => {
            handler.showWarning('This is a warning');
            
            const container = document.getElementById('notificationContainer');
            const notification = container.querySelector('.notification.warning');
            
            expect(notification).toBeTruthy();
            expect(notification.textContent).toContain('This is a warning');
            expect(notification.querySelector('.notification-icon').textContent).toBe('⚠️');
        });

        it('should auto-dismiss warning notification after 5 seconds', async () => {
            vi.useFakeTimers();
            
            handler.showWarning('Test warning');
            
            const container = document.getElementById('notificationContainer');
            let notification = container.querySelector('.notification.warning');
            expect(notification).toBeTruthy();
            
            // Fast-forward time
            vi.advanceTimersByTime(5000);
            await new Promise(resolve => setTimeout(resolve, 0));
            
            notification = container.querySelector('.notification.warning');
            expect(notification).toBeFalsy();
            
            vi.useRealTimers();
        });
    });

    describe('Info Notifications', () => {
        let handler;

        beforeEach(() => {
            handler = new ErrorHandler();
        });

        it('should show info notification', () => {
            handler.showInfo('Here is some information');
            
            const container = document.getElementById('notificationContainer');
            const notification = container.querySelector('.notification.info');
            
            expect(notification).toBeTruthy();
            expect(notification.textContent).toContain('Here is some information');
            expect(notification.querySelector('.notification-icon').textContent).toBe('ℹ️');
        });

        it('should auto-dismiss info notification after 4 seconds', async () => {
            vi.useFakeTimers();
            
            handler.showInfo('Test info');
            
            const container = document.getElementById('notificationContainer');
            let notification = container.querySelector('.notification.info');
            expect(notification).toBeTruthy();
            
            // Fast-forward time
            vi.advanceTimersByTime(4000);
            await new Promise(resolve => setTimeout(resolve, 0));
            
            notification = container.querySelector('.notification.info');
            expect(notification).toBeFalsy();
            
            vi.useRealTimers();
        });
    });

    describe('Notification Stack Management', () => {
        let handler;

        beforeEach(() => {
            handler = new ErrorHandler();
        });

        it('should limit maximum number of notifications', () => {
            // Show more than the maximum (10)
            for (let i = 0; i < 15; i++) {
                handler.showInfo(`Notification ${i}`);
            }
            
            const container = document.getElementById('notificationContainer');
            const notifications = container.querySelectorAll('.notification');
            
            expect(notifications.length).toBeLessThanOrEqual(10);
        });

        it('should remove oldest notifications when limit exceeded', () => {
            // Show notifications
            handler.showInfo('First notification');
            handler.showInfo('Second notification');
            
            // Show many more to exceed limit
            for (let i = 0; i < 10; i++) {
                handler.showInfo(`Notification ${i}`);
            }
            
            const container = document.getElementById('notificationContainer');
            const notifications = container.querySelectorAll('.notification');
            
            // Should not contain the first notification
            const notificationTexts = Array.from(notifications).map(n => n.textContent);
            expect(notificationTexts).not.toContain('First notification');
        });

        it('should track notifications in internal array', () => {
            handler.showSuccess('Test 1');
            handler.showError('Test 2');
            handler.showWarning('Test 3');
            
            expect(handler.notifications).toHaveLength(3);
        });
    });

    describe('HTML Escaping', () => {
        let handler;

        beforeEach(() => {
            handler = new ErrorHandler();
        });

        it('should escape HTML in notification messages', () => {
            handler.showError('<script>alert("xss")</script>');
            
            const container = document.getElementById('notificationContainer');
            const notification = container.querySelector('.notification.error');
            const message = notification.querySelector('.notification-message');
            
            expect(message.innerHTML).not.toContain('<script>');
            expect(message.textContent).toContain('alert("xss")');
        });

        it('should handle special characters in messages', () => {
            handler.showInfo('Message with "quotes" & <brackets>');
            
            const container = document.getElementById('notificationContainer');
            const notification = container.querySelector('.notification.info');
            const message = notification.querySelector('.notification-message');
            
            expect(message.textContent).toBe('Message with "quotes" & <brackets>');
        });
    });

    describe('Animation and Styling', () => {
        let handler;

        beforeEach(() => {
            handler = new ErrorHandler();
        });

        it('should add correct CSS classes to notifications', () => {
            handler.showSuccess('Test');
            handler.showError('Test');
            handler.showWarning('Test');
            handler.showInfo('Test');
            
            const container = document.getElementById('notificationContainer');
            const notifications = container.querySelectorAll('.notification');
            
            expect(notifications[0].classList.contains('success')).toBe(true);
            expect(notifications[1].classList.contains('error')).toBe(true);
            expect(notifications[2].classList.contains('warning')).toBe(true);
            expect(notifications[3].classList.contains('info')).toBe(true);
        });

        it('should add slide-in animation class', () => {
            handler.showInfo('Test message');
            
            const container = document.getElementById('notificationContainer');
            const notification = container.querySelector('.notification');
            
            expect(notification.classList.contains('slideInRight')).toBe(true);
        });
    });

    describe('Error Logging', () => {
        let handler;

        beforeEach(() => {
            handler = new ErrorHandler();
        });

        it('should log errors to console', () => {
            handler.showError('Test error message');
            
            expect(console.error).toHaveBeenCalledWith('Error:', 'Test error message');
        });

        it('should log warnings to console', () => {
            handler.showWarning('Test warning message');
            
            expect(console.warn).toHaveBeenCalledWith('Warning:', 'Test warning message');
        });

        it('should not log success messages to console', () => {
            handler.showSuccess('Test success message');
            
            expect(console.log).not.toHaveBeenCalled();
            expect(console.error).not.toHaveBeenCalled();
            expect(console.warn).not.toHaveBeenCalled();
        });

        it('should not log info messages to console', () => {
            handler.showInfo('Test info message');
            
            expect(console.log).not.toHaveBeenCalled();
            expect(console.error).not.toHaveBeenCalled();
            expect(console.warn).not.toHaveBeenCalled();
        });
    });

    describe('Edge Cases', () => {
        let handler;

        beforeEach(() => {
            handler = new ErrorHandler();
        });

        it('should handle empty message', () => {
            handler.showError('');
            
            const container = document.getElementById('notificationContainer');
            const notification = container.querySelector('.notification.error');
            
            expect(notification).toBeTruthy();
            expect(notification.querySelector('.notification-message').textContent).toBe('');
        });

        it('should handle null message', () => {
            handler.showError(null);
            
            const container = document.getElementById('notificationContainer');
            const notification = container.querySelector('.notification.error');
            
            expect(notification).toBeTruthy();
            expect(notification.querySelector('.notification-message').textContent).toBe('null');
        });

        it('should handle undefined message', () => {
            handler.showError(undefined);
            
            const container = document.getElementById('notificationContainer');
            const notification = container.querySelector('.notification.error');
            
            expect(notification).toBeTruthy();
            expect(notification.querySelector('.notification-message').textContent).toBe('undefined');
        });

        it('should handle very long messages', () => {
            const longMessage = 'A'.repeat(1000);
            handler.showError(longMessage);
            
            const container = document.getElementById('notificationContainer');
            const notification = container.querySelector('.notification.error');
            
            expect(notification).toBeTruthy();
            expect(notification.querySelector('.notification-message').textContent).toBe(longMessage);
        });
    });

    describe('Performance', () => {
        let handler;

        beforeEach(() => {
            handler = new ErrorHandler();
        });

        it('should handle rapid notification creation efficiently', () => {
            const startTime = performance.now();
            
            // Create many notifications rapidly
            for (let i = 0; i < 100; i++) {
                handler.showInfo(`Notification ${i}`);
            }
            
            const endTime = performance.now();
            
            // Should complete quickly
            expect(endTime - startTime).toBeLessThan(100);
        });

        it('should clean up timers properly', () => {
            vi.useFakeTimers();
            
            handler.showSuccess('Test');
            handler.showWarning('Test');
            handler.showInfo('Test');
            
            // Fast-forward all timers
            vi.advanceTimersByTime(10000);
            
            const container = document.getElementById('notificationContainer');
            const notifications = container.querySelectorAll('.notification');
            
            // Only error notifications should remain (no auto-dismiss)
            expect(notifications.length).toBe(0);
            
            vi.useRealTimers();
        });
    });
});
