// Performance optimization utilities for Prompt Hero
class PerformanceOptimizer {
    constructor() {
        this.observers = new Map();
        this.metrics = new Map();
        this.init();
    }

    init() {
        this.setupPerformanceObserver();
        this.setupLazyLoading();
        this.setupImageOptimization();
        this.setupDebouncing();
        this.setupVirtualScrolling();
    }

    // Performance Observer for monitoring
    setupPerformanceObserver() {
        if ('PerformanceObserver' in window) {
            // Observe navigation timing
            const navObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.trackMetric('navigation', entry);
                }
            });
            navObserver.observe({ entryTypes: ['navigation'] });

            // Observe resource timing
            const resourceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.duration > 1000) { // Log slow resources
                        console.warn('Slow resource:', entry.name, entry.duration + 'ms');
                    }
                }
            });
            resourceObserver.observe({ entryTypes: ['resource'] });

            // Observe paint timing
            const paintObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.trackMetric('paint', entry);
                }
            });
            paintObserver.observe({ entryTypes: ['paint'] });
        }
    }

    // Lazy loading for images and content
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            const imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        if (img.dataset.src) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                            imageObserver.unobserve(img);
                        }
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });

            // Observe all images with data-src
            document.querySelectorAll('img[data-src]').forEach(img => {
                imageObserver.observe(img);
            });

            // Observe content sections
            const contentObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('loaded');
                        contentObserver.unobserve(entry.target);
                    }
                });
            });

            document.querySelectorAll('.lazy-content').forEach(section => {
                contentObserver.observe(section);
            });
        }
    }

    // Image optimization
    setupImageOptimization() {
        // WebP support detection
        const supportsWebP = this.detectWebPSupport();
        
        // Optimize existing images
        document.querySelectorAll('img').forEach(img => {
            this.optimizeImage(img, supportsWebP);
        });

        // Optimize dynamically added images
        const imageObserver = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        if (node.tagName === 'IMG') {
                            this.optimizeImage(node, supportsWebP);
                        }
                        node.querySelectorAll('img').forEach(img => {
                            this.optimizeImage(img, supportsWebP);
                        });
                    }
                });
            });
        });

        imageObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    detectWebPSupport() {
        return new Promise((resolve) => {
            const webP = new Image();
            webP.onload = webP.onerror = () => {
                resolve(webP.height === 2);
            };
            webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
        });
    }

    optimizeImage(img, supportsWebP) {
        // Add loading="lazy" if not present
        if (!img.hasAttribute('loading')) {
            img.setAttribute('loading', 'lazy');
        }

        // Add decoding="async" for better performance
        if (!img.hasAttribute('decoding')) {
            img.setAttribute('decoding', 'async');
        }

        // Convert to WebP if supported
        if (supportsWebP && img.src && !img.src.includes('.webp')) {
            const webpSrc = img.src.replace(/\.(jpg|jpeg|png)$/i, '.webp');
            img.src = webpSrc;
        }
    }

    // Debouncing for search and filters
    setupDebouncing() {
        const debounceMap = new Map();

        // Debounce search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            this.debounce(searchInput, 'input', (e) => {
                if (window.advancedSearch) {
                    window.advancedSearch.handleSearchInput(e.target.value);
                }
            }, 300);
        }

        // Debounce filter changes
        document.querySelectorAll('.filter-chip').forEach(filter => {
            this.debounce(filter, 'click', (e) => {
                // Handle filter click
            }, 100);
        });

        // Debounce resize events
        this.debounce(window, 'resize', () => {
            this.handleResize();
        }, 250);
    }

    debounce(element, event, handler, delay) {
        const key = `${element}_${event}`;
        
        if (!this.debounceMap) {
            this.debounceMap = new Map();
        }

        const existing = this.debounceMap.get(key);
        if (existing) {
            clearTimeout(existing);
        }

        const timeoutId = setTimeout(() => {
            handler();
            this.debounceMap.delete(key);
        }, delay);

        this.debounceMap.set(key, timeoutId);
    }

    // Virtual scrolling for large lists
    setupVirtualScrolling() {
        const virtualScrollContainers = document.querySelectorAll('.virtual-scroll');
        
        virtualScrollContainers.forEach(container => {
            this.initVirtualScrolling(container);
        });
    }

    initVirtualScrolling(container) {
        const itemHeight = 200; // Height of each item
        const containerHeight = container.clientHeight;
        const visibleItems = Math.ceil(containerHeight / itemHeight) + 2; // Buffer
        const totalItems = container.dataset.totalItems || 1000;

        let startIndex = 0;
        let endIndex = Math.min(startIndex + visibleItems, totalItems);

        const renderItems = () => {
            const fragment = document.createDocumentFragment();
            
            for (let i = startIndex; i < endIndex; i++) {
                const item = this.createVirtualItem(i);
                fragment.appendChild(item);
            }

            container.innerHTML = '';
            container.appendChild(fragment);
        };

        const handleScroll = () => {
            const scrollTop = container.scrollTop;
            const newStartIndex = Math.floor(scrollTop / itemHeight);
            
            if (newStartIndex !== startIndex) {
                startIndex = newStartIndex;
                endIndex = Math.min(startIndex + visibleItems, totalItems);
                renderItems();
            }
        };

        container.addEventListener('scroll', this.throttle(handleScroll, 16)); // 60fps
        renderItems();
    }

    createVirtualItem(index) {
        const item = document.createElement('div');
        item.className = 'virtual-item';
        item.style.height = '200px';
        item.style.position = 'absolute';
        item.style.top = `${index * 200}px`;
        item.style.width = '100%';
        item.textContent = `Item ${index + 1}`;
        return item;
    }

    // Throttling utility
    throttle(func, limit) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    // Handle window resize
    handleResize() {
        // Update virtual scrolling containers
        document.querySelectorAll('.virtual-scroll').forEach(container => {
            // Recalculate visible items
            const containerHeight = container.clientHeight;
            const itemHeight = 200;
            const visibleItems = Math.ceil(containerHeight / itemHeight) + 2;
            
            // Update container if needed
            container.dataset.visibleItems = visibleItems;
        });

        // Update responsive layouts
        this.updateResponsiveLayout();
    }

    updateResponsiveLayout() {
        const width = window.innerWidth;
        const isMobile = width < 768;
        const isTablet = width >= 768 && width < 1024;
        const isDesktop = width >= 1024;

        document.body.classList.toggle('mobile', isMobile);
        document.body.classList.toggle('tablet', isTablet);
        document.body.classList.toggle('desktop', isDesktop);

        // Update grid columns based on screen size
        const grids = document.querySelectorAll('.responsive-grid');
        grids.forEach(grid => {
            if (isMobile) {
                grid.style.gridTemplateColumns = '1fr';
            } else if (isTablet) {
                grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
            } else {
                grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
            }
        });
    }

    // Performance metrics tracking
    trackMetric(type, entry) {
        if (!this.metrics.has(type)) {
            this.metrics.set(type, []);
        }

        const metrics = this.metrics.get(type);
        metrics.push({
            name: entry.name,
            duration: entry.duration,
            timestamp: Date.now()
        });

        // Keep only last 100 entries
        if (metrics.length > 100) {
            metrics.shift();
        }

        // Log slow operations
        if (entry.duration > 1000) {
            console.warn(`Slow ${type}:`, entry.name, entry.duration + 'ms');
        }
    }

    // Get performance metrics
    getMetrics() {
        const result = {};
        for (const [type, metrics] of this.metrics) {
            result[type] = {
                count: metrics.length,
                average: metrics.reduce((sum, m) => sum + m.duration, 0) / metrics.length,
                max: Math.max(...metrics.map(m => m.duration)),
                min: Math.min(...metrics.map(m => m.duration))
            };
        }
        return result;
    }

    // Preload critical resources
    preloadResource(href, as = 'script') {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = href;
        link.as = as;
        document.head.appendChild(link);
    }

    // Prefetch resources for next page
    prefetchResource(href) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = href;
        document.head.appendChild(link);
    }

    // Optimize CSS delivery
    optimizeCSS() {
        // Inline critical CSS
        const criticalCSS = `
            .header { display: flex; justify-content: space-between; align-items: center; }
            .prompt-card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; }
            .loading { display: flex; justify-content: center; align-items: center; }
        `;

        const style = document.createElement('style');
        style.textContent = criticalCSS;
        document.head.insertBefore(style, document.head.firstChild);

        // Load non-critical CSS asynchronously
        const nonCriticalCSS = document.querySelectorAll('link[rel="stylesheet"]:not([data-critical])');
        nonCriticalCSS.forEach(link => {
            link.media = 'print';
            link.onload = () => {
                link.media = 'all';
            };
        });
    }

    // Service Worker registration for caching
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.log('Service Worker registration failed:', error);
                });
        }
    }

    // Memory usage monitoring
    getMemoryUsage() {
        if ('memory' in performance) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
            };
        }
        return null;
    }

    // Cleanup resources
    cleanup() {
        // Clear observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();

        // Clear debounce timers
        if (this.debounceMap) {
            this.debounceMap.forEach(timeoutId => clearTimeout(timeoutId));
            this.debounceMap.clear();
        }

        // Clear metrics
        this.metrics.clear();
    }
}

// Global performance optimizer instance
window.performanceOptimizer = new PerformanceOptimizer();

// Initialize performance optimizations when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Optimize CSS delivery
    window.performanceOptimizer.optimizeCSS();

    // Preload critical resources
    window.performanceOptimizer.preloadResource('/js/prompt-manager.js');
    window.performanceOptimizer.preloadResource('/css/styles.css');

    // Register service worker
    window.performanceOptimizer.registerServiceWorker();

    // Monitor memory usage
    setInterval(() => {
        const memory = window.performanceOptimizer.getMemoryUsage();
        if (memory && memory.used > 100) { // 100MB threshold
            console.warn('High memory usage:', memory);
        }
    }, 30000); // Check every 30 seconds
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    window.performanceOptimizer.cleanup();
});

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceOptimizer;
}
