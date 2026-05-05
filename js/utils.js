/**
 * ============================================================================
 * UTILS.JS - Utility Functions
 * ============================================================================
 * Common helper functions used across the application.
 * @module utils
 */

/**
 * Generates a unique ID using timestamp and random string
 * @returns {string} Unique identifier
 */
export function generateId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Creates a debounced function that delays invoking func
 * @param {Function} func - The function to debounce
 * @param {number} wait - Milliseconds to delay
 * @returns {Function} Debounced function
 */
export function debounce(func, wait = 300) {
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

/**
 * Creates a throttled function that only invokes func at most once per wait period
 * @param {Function} func - The function to throttle
 * @param {number} wait - Milliseconds to wait between calls
 * @returns {Function} Throttled function
 */
export function throttle(func, wait = 100) {
    let lastTime = 0;
    return function (...args) {
        const now = Date.now();
        if (now - lastTime >= wait) {
            lastTime = now;
            func(...args);
        }
    };
}

/**
 * Deep clones an object using JSON serialization
 * @param {Object} obj - Object to clone
 * @returns {Object} Cloned object
 */
export function deepClone(obj) {
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        console.error('Failed to deep clone:', e);
        return obj;
    }
}

/**
 * Formats a date to a relative string (e.g., "2 days ago", "in 3 hours")
 * @param {Date|string|number} date - Date to format
 * @returns {string} Relative time string
 */
export function formatRelativeTime(date) {
    const now = new Date();
    const targetDate = new Date(date);
    const diffMs = targetDate - now;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.round(diffMs / (1000 * 60));

    if (Math.abs(diffMinutes) < 1) return 'just now';
    if (Math.abs(diffMinutes) < 60) {
        return diffMinutes > 0 
            ? `in ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''}`
            : `${Math.abs(diffMinutes)} minute${Math.abs(diffMinutes) !== 1 ? 's' : ''} ago`;
    }
    if (Math.abs(diffHours) < 24) {
        return diffHours > 0 
            ? `in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`
            : `${Math.abs(diffHours)} hour${Math.abs(diffHours) !== 1 ? 's' : ''} ago`;
    }
    if (Math.abs(diffDays) < 7) {
        return diffDays > 0 
            ? `in ${diffDays} day${diffDays !== 1 ? 's' : ''}`
            : `${Math.abs(diffDays)} day${Math.abs(diffDays) !== 1 ? 's' : ''} ago`;
    }

    return targetDate.toLocaleDateString('en-GB', {
        month: 'short',
        day: 'numeric',
        year: targetDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

/**
 * Formats a date to a short string (e.g., "Jan 15" or "Jan 15, 2024")
 * @param {Date|string|number} date - Date to format
 * @returns {string} Formatted date string
 */
export function formatDate(date) {
    const d = new Date(date);
    const now = new Date();
    return d.toLocaleDateString('en-GB', {
        month: 'short',
        day: 'numeric',
        year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
}

/**
 * Formats a date to ISO date string (YYYY-MM-DD)
 * @param {Date|string|number} date - Date to format
 * @returns {string} ISO date string
 */
export function formatDateISO(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
}

/**
 * Checks if a date is today
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is today
 */
export function isToday(date) {
    const d = new Date(date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
}

/**
 * Checks if a date is in the past
 * @param {Date|string|number} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export function isPast(date) {
    return new Date(date) < new Date();
}

/**
 * Gets the initials from a name (e.g., "John Doe" -> "JD")
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 characters)
 */
export function getInitials(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Escapes HTML special characters to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Truncates a string to a specified length with ellipsis
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated string
 */
export function truncate(str, maxLength = 50) {
    if (!str || str.length <= maxLength) return str;
    return str.substring(0, maxLength - 3) + '...';
}

/**
 * Calculates contrast ratio between two colors
 * @param {string} color1 - First color (hex)
 * @param {string} color2 - Second color (hex)
 * @returns {number} Contrast ratio
 */
export function getContrastRatio(color1, color2) {
    const lum1 = getLuminance(color1);
    const lum2 = getLuminance(color2);
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);
    return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Gets the relative luminance of a color
 * @param {string} hex - Hex color code
 * @returns {number} Relative luminance value
 */
export function getLuminance(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return 0;
    
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Converts hex color to RGB object
 * @param {string} hex - Hex color code
 * @returns {{r: number, g: number, b: number}|null} RGB values or null
 */
export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

/**
 * Determines if text should be light or dark based on background color
 * @param {string} backgroundColor - Background color (hex)
 * @returns {string} 'light' or 'dark'
 */
export function getTextColorForBackground(backgroundColor) {
    const luminance = getLuminance(backgroundColor);
    return luminance > 0.179 ? 'dark' : 'light';
}

/**
 * Checks if a color passes WCAG AA contrast with white/black text
 * @param {string} backgroundColor - Background color (hex)
 * @returns {{passesWithWhite: boolean, passesWithBlack: boolean}} Contrast check results
 */
export function checkColorAccessibility(backgroundColor) {
    const whiteContrast = getContrastRatio(backgroundColor, '#FFFFFF');
    const blackContrast = getContrastRatio(backgroundColor, '#000000');
    
    return {
        passesWithWhite: whiteContrast >= 4.5,
        passesWithBlack: blackContrast >= 4.5,
        recommendedText: whiteContrast >= blackContrast ? '#FFFFFF' : '#000000'
    };
}

/**
 * Sanitizes a string for use in HTML attributes
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeAttribute(str) {
    if (!str) return '';
    return str.replace(/['"<>&]/g, char => {
        const entities = {
            "'": '&#39;',
            '"': '&quot;',
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;'
        };
        return entities[char];
    });
}

/**
 * Simple search function that matches query against multiple fields
 * @param {Array} items - Array of items to search
 * @param {string} query - Search query
 * @param {Array<string>} fields - Fields to search in
 * @returns {Array} Filtered items
 */
export function searchItems(items, query, fields = ['title', 'description']) {
    if (!query || !query.trim()) return items;
    
    const normalizedQuery = query.toLowerCase().trim();
    return items.filter(item => {
        return fields.some(field => {
            const value = item[field];
            if (typeof value === 'string') {
                return value.toLowerCase().includes(normalizedQuery);
            }
            if (Array.isArray(value)) {
                return value.some(v => 
                    typeof v === 'string' && v.toLowerCase().includes(normalizedQuery)
                );
            }
            return false;
        });
    });
}

/**
 * Sorts an array of objects by a key
 * @param {Array} items - Array to sort
 * @param {string} key - Key to sort by
 * @param {string} direction - 'asc' or 'desc'
 * @returns {Array} Sorted array
 */
export function sortBy(items, key, direction = 'asc') {
    const sorted = [...items].sort((a, b) => {
        let valA = a[key];
        let valB = b[key];
        
        // Handle dates
        if (key.includes('date') || key.includes('Date')) {
            valA = valA ? new Date(valA).getTime() : 0;
            valB = valB ? new Date(valB).getTime() : 0;
        }
        
        // Handle strings
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        
        if (valA < valB) return -1;
        if (valA > valB) return 1;
        return 0;
    });
    
    return direction === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Groups an array of objects by a key
 * @param {Array} items - Array to group
 * @param {string} key - Key to group by
 * @returns {Object} Grouped object
 */
export function groupBy(items, key) {
    return items.reduce((groups, item) => {
        const value = item[key] || 'undefined';
        (groups[value] = groups[value] || []).push(item);
        return groups;
    }, {});
}

/**
 * Waits for a specified amount of time
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after the delay
 */
export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generates a random color from a predefined contrast-safe palette
 * @returns {string} Hex color code
 */
export function getRandomLabelColor() {
    const colors = [
        '#DC2626', // Red
        '#EA580C', // Orange
        '#D97706', // Amber
        '#65A30D', // Lime
        '#16A34A', // Green
        '#059669', // Emerald
        '#0D9488', // Teal
        '#0891B2', // Cyan
        '#0284C7', // Sky
        '#2563EB', // Blue
        '#4F46E5', // Indigo
        '#7C3AED', // Violet
        '#9333EA', // Purple
        '#C026D3', // Fuchsia
        '#DB2777', // Pink
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Checks if the current device prefers reduced motion
 * @returns {boolean} True if reduced motion is preferred
 */
export function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Checks if the current device prefers dark mode
 * @returns {boolean} True if dark mode is preferred
 */
export function prefersDarkMode() {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Copies text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy:', err);
        return false;
    }
}

/**
 * Creates an element from an HTML string
 * @param {string} html - HTML string
 * @returns {Element} Created element
 */
export function createElement(html) {
    const template = document.createElement('template');
    template.innerHTML = html.trim();
    return template.content.firstChild;
}

/**
 * Checks if an element is visible in the viewport
 * @param {Element} element - Element to check
 * @returns {boolean} True if element is visible
 */
export function isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
        rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
}
