/**
 * ============================================================================
 * UI.JS - UI Components and Interactions
 * ============================================================================
 * Core UI components: toasts, modals, dropdowns, tooltips.
 * @module ui
 */

import { escapeHtml, createElement, prefersReducedMotion, getInitials } from './utils.js';
import { getState, setState, getMembers, getMember } from './state.js';

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

/**
 * Toast notification queue and state
 */
const toastState = {
    container: null,
    queue: [],
    maxVisible: 5
};

/**
 * Toast notification system
 */
export const Toast = {
    /**
     * Initializes the toast container
     */
    init() {
        if (toastState.container) return;
        
        toastState.container = document.createElement('div');
        toastState.container.className = 'toast-container';
        toastState.container.setAttribute('role', 'region');
        toastState.container.setAttribute('aria-live', 'polite');
        toastState.container.setAttribute('aria-label', 'Notifications');
        document.body.appendChild(toastState.container);
    },

    /**
     * Shows a toast notification
     * @param {Object} options - Toast options
     * @returns {HTMLElement} Toast element
     */
    show({ type = 'info', title, message, duration = 5000, action = null }) {
        this.init();

        const toast = createElement(`
            <div class="toast toast--${type}" role="alert" aria-live="assertive">
                <svg class="toast__icon icon" aria-hidden="true">
                    <use href="#icon-${this.getIcon(type)}"></use>
                </svg>
                <div class="toast__content">
                    ${title ? `<div class="toast__title">${escapeHtml(title)}</div>` : ''}
                    ${message ? `<div class="toast__message">${escapeHtml(message)}</div>` : ''}
                </div>
                ${action ? `
                    <button class="btn btn--ghost btn--sm toast__action" type="button">
                        ${escapeHtml(action.label)}
                    </button>
                ` : ''}
                <button class="toast__close" type="button" aria-label="Dismiss notification">
                    <svg class="icon icon--sm" aria-hidden="true">
                        <use href="#icon-x"></use>
                    </svg>
                </button>
            </div>
        `);

        // Handle action click
        if (action) {
            toast.querySelector('.toast__action')?.addEventListener('click', () => {
                action.onClick?.();
                this.dismiss(toast);
            });
        }

        // Handle close click
        toast.querySelector('.toast__close').addEventListener('click', () => {
            this.dismiss(toast);
        });

        // Add to container
        toastState.container.appendChild(toast);

        // Auto dismiss
        if (duration > 0) {
            setTimeout(() => this.dismiss(toast), duration);
        }

        // Limit visible toasts
        const toasts = toastState.container.querySelectorAll('.toast:not(.is-exiting)');
        if (toasts.length > toastState.maxVisible) {
            this.dismiss(toasts[0]);
        }

        return toast;
    },

    /**
     * Dismisses a toast
     * @param {HTMLElement} toast - Toast element
     */
    dismiss(toast) {
        if (!toast || toast.classList.contains('is-exiting')) return;

        toast.classList.add('is-exiting');
        
        const handleEnd = () => {
            toast.remove();
        };

        if (prefersReducedMotion()) {
            handleEnd();
        } else {
            toast.addEventListener('animationend', handleEnd, { once: true });
            // Fallback timeout
            setTimeout(handleEnd, 300);
        }
    },

    /**
     * Gets the icon name for a toast type
     * @param {string} type - Toast type
     * @returns {string} Icon name
     */
    getIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'x-circle',
            warning: 'alert-circle',
            info: 'info'
        };
        return icons[type] || icons.info;
    },

    // Convenience methods
    success: (title, message) => Toast.show({ type: 'success', title, message }),
    error: (title, message) => Toast.show({ type: 'error', title, message }),
    warning: (title, message) => Toast.show({ type: 'warning', title, message }),
    info: (title, message) => Toast.show({ type: 'info', title, message })
};

// ============================================================================
// MODAL SYSTEM
// ============================================================================

/**
 * Modal state
 */
const modalState = {
    stack: [],
    backdrop: null
};

/**
 * Modal dialog system
 */
export const Modal = {
    /**
     * Opens a modal dialog
     * @param {Object} options - Modal options
     * @returns {HTMLElement} Modal element
     */
    open({ 
        title, 
        content, 
        size = '', 
        closable = true, 
        onClose = null,
        footer = null 
    }) {
        // Create backdrop if needed
        if (!modalState.backdrop) {
            modalState.backdrop = createElement(`
                <div class="modal-backdrop" aria-hidden="true"></div>
            `);
            document.body.appendChild(modalState.backdrop);
        }

        const sizeClass = size ? `modal--${size}` : '';
        
        const modal = createElement(`
            <div class="modal ${sizeClass}" role="dialog" aria-modal="true" aria-labelledby="modal-title">
                <div class="modal__header">
                    <h2 id="modal-title" class="modal__title">${escapeHtml(title)}</h2>
                    ${closable ? `
                        <button class="modal__close" type="button" aria-label="Close dialog">
                            <svg class="icon" aria-hidden="true">
                                <use href="#icon-x"></use>
                            </svg>
                        </button>
                    ` : ''}
                </div>
                <div class="modal__body"></div>
                ${footer ? '<div class="modal__footer"></div>' : ''}
            </div>
        `);

        // Set content
        const body = modal.querySelector('.modal__body');
        if (typeof content === 'string') {
            body.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            body.appendChild(content);
        }

        // Set footer
        if (footer) {
            const footerEl = modal.querySelector('.modal__footer');
            if (typeof footer === 'string') {
                footerEl.innerHTML = footer;
            } else if (footer instanceof HTMLElement) {
                footerEl.appendChild(footer);
            }
        }

        // Handle close
        if (closable) {
            const closeBtn = modal.querySelector('.modal__close');
            closeBtn?.addEventListener('click', () => this.close(modal, onClose));

            // Close on backdrop click
            modalState.backdrop.addEventListener('click', (e) => {
                if (e.target === modalState.backdrop) {
                    this.close(modal, onClose);
                }
            });

            // Close on Escape
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.close(modal, onClose);
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        }

        // Add to DOM
        document.body.appendChild(modal);
        modalState.stack.push(modal);

        // Show with animation
        requestAnimationFrame(() => {
            modalState.backdrop.classList.add('is-visible');
            modal.classList.add('is-visible');
        });

        // Focus trap
        this.trapFocus(modal);

        // Prevent body scroll
        document.body.style.overflow = 'hidden';

        return modal;
    },

    /**
     * Closes a modal
     * @param {HTMLElement} [modal] - Specific modal or top of stack
     * @param {Function} [onClose] - Close callback
     */
    close(modal, onClose) {
        const target = modal || modalState.stack[modalState.stack.length - 1];
        if (!target) return;

        target.classList.remove('is-visible');

        const cleanup = () => {
            target.remove();
            modalState.stack = modalState.stack.filter(m => m !== target);

            if (modalState.stack.length === 0 && modalState.backdrop) {
                modalState.backdrop.classList.remove('is-visible');
                document.body.style.overflow = '';
            }

            onClose?.();
        };

        if (prefersReducedMotion()) {
            cleanup();
        } else {
            target.addEventListener('transitionend', cleanup, { once: true });
            setTimeout(cleanup, 300);
        }
    },

    /**
     * Closes all modals
     */
    closeAll() {
        [...modalState.stack].forEach(modal => this.close(modal));
    },

    /**
     * Traps focus within a modal
     * @param {HTMLElement} modal - Modal element
     */
    trapFocus(modal) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];

        firstFocusable?.focus();

        modal.addEventListener('keydown', (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable?.focus();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable?.focus();
                }
            }
        });
    },

    /**
     * Shows a confirmation dialog
     * @param {Object} options - Confirm options
     * @returns {Promise<boolean>} User choice
     */
    confirm({ title, message, confirmText = 'Confirm', cancelText = 'Cancel', danger = false }) {
        return new Promise((resolve) => {
            const footer = createElement(`
                <div class="flex gap-3 justify-end">
                    <button class="btn btn--secondary cancel-btn" type="button">${escapeHtml(cancelText)}</button>
                    <button class="btn ${danger ? 'btn--danger' : 'btn--primary'} confirm-btn" type="button">
                        ${escapeHtml(confirmText)}
                    </button>
                </div>
            `);

            const modal = this.open({
                title,
                content: `<p class="text-secondary">${escapeHtml(message)}</p>`,
                footer,
                closable: true,
                onClose: () => resolve(false)
            });

            footer.querySelector('.cancel-btn').addEventListener('click', () => {
                this.close(modal);
                resolve(false);
            });

            footer.querySelector('.confirm-btn').addEventListener('click', () => {
                this.close(modal);
                resolve(true);
            });
        });
    }
};

// ============================================================================
// DROPDOWN MENUS
// ============================================================================

/**
 * Active dropdown reference
 */
let activeDropdown = null;

/**
 * Dropdown menu system
 */
export const Dropdown = {
    /**
     * Creates a dropdown
     * @param {HTMLElement} trigger - Trigger element
     * @param {Object} options - Dropdown options
     * @returns {Object} Dropdown controls
     */
    create(trigger, { items = [], position = 'bottom-start', onSelect = null }) {
        const menu = createElement(`
            <div class="dropdown__menu" role="menu" aria-hidden="true">
                ${items.map(item => this.renderItem(item)).join('')}
            </div>
        `);

        // Create wrapper
        const wrapper = document.createElement('div');
        wrapper.className = 'dropdown';
        trigger.parentNode.insertBefore(wrapper, trigger);
        wrapper.appendChild(trigger);
        wrapper.appendChild(menu);

        // Handle trigger click
        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle(wrapper);
        });

        // Handle item clicks
        menu.addEventListener('click', (e) => {
            const item = e.target.closest('.dropdown__item');
            if (item && !item.disabled) {
                const value = item.dataset.value;
                onSelect?.(value, item);
                this.close(wrapper);
            }
        });

        // Handle keyboard
        wrapper.addEventListener('keydown', (e) => {
            if (!wrapper.classList.contains('is-open')) return;

            const items = menu.querySelectorAll('.dropdown__item:not([disabled])');
            const currentIndex = Array.from(items).indexOf(document.activeElement);

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    items[(currentIndex + 1) % items.length]?.focus();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    items[(currentIndex - 1 + items.length) % items.length]?.focus();
                    break;
                case 'Enter':
                case ' ':
                    if (document.activeElement.classList.contains('dropdown__item')) {
                        e.preventDefault();
                        document.activeElement.click();
                    }
                    break;
                case 'Escape':
                    this.close(wrapper);
                    trigger.focus();
                    break;
            }
        });

        return {
            element: wrapper,
            open: () => this.open(wrapper),
            close: () => this.close(wrapper),
            toggle: () => this.toggle(wrapper),
            updateItems: (newItems) => {
                menu.innerHTML = newItems.map(item => this.renderItem(item)).join('');
            }
        };
    },

    /**
     * Renders a dropdown item
     * @param {Object} item - Item config
     * @returns {string} HTML string
     */
    renderItem(item) {
        if (item.divider) {
            return '<div class="dropdown__divider" role="separator"></div>';
        }

        const classes = ['dropdown__item'];
        if (item.danger) classes.push('dropdown__item--danger');
        if (item.disabled) classes.push('dropdown__item--disabled');

        return `
            <button 
                class="${classes.join(' ')}" 
                type="button"
                role="menuitem"
                data-value="${escapeHtml(item.value || '')}"
                ${item.disabled ? 'disabled' : ''}
            >
                ${item.icon ? `
                    <svg class="icon icon--sm" aria-hidden="true">
                        <use href="#icon-${item.icon}"></use>
                    </svg>
                ` : ''}
                <span>${escapeHtml(item.label)}</span>
                ${item.shortcut ? `<kbd class="text-xs text-tertiary ml-auto">${item.shortcut}</kbd>` : ''}
            </button>
        `;
    },

    /**
     * Opens a dropdown
     * @param {HTMLElement} dropdown - Dropdown element
     */
    open(dropdown) {
        // Close any active dropdown
        if (activeDropdown && activeDropdown !== dropdown) {
            this.close(activeDropdown);
        }

        dropdown.classList.add('is-open');
        dropdown.querySelector('.dropdown__menu')?.setAttribute('aria-hidden', 'false');
        activeDropdown = dropdown;

        // Position menu
        const menu = dropdown.querySelector('.dropdown__menu');
        const trigger = dropdown.querySelector(':scope > button, :scope > [data-dropdown-trigger]');
        
        if (menu && trigger) {
            const triggerRect = trigger.getBoundingClientRect();
            const menuRect = menu.getBoundingClientRect();
            
            // Adjust if overflowing viewport
            if (triggerRect.left + menuRect.width > window.innerWidth) {
                menu.classList.add('dropdown__menu--right');
            }
        }
    },

    /**
     * Closes a dropdown
     * @param {HTMLElement} dropdown - Dropdown element
     */
    close(dropdown) {
        dropdown?.classList.remove('is-open');
        dropdown?.querySelector('.dropdown__menu')?.setAttribute('aria-hidden', 'true');
        
        if (activeDropdown === dropdown) {
            activeDropdown = null;
        }
    },

    /**
     * Toggles a dropdown
     * @param {HTMLElement} dropdown - Dropdown element
     */
    toggle(dropdown) {
        if (dropdown.classList.contains('is-open')) {
            this.close(dropdown);
        } else {
            this.open(dropdown);
        }
    }
};

// Close dropdowns on outside click
document.addEventListener('click', (e) => {
    if (activeDropdown && !activeDropdown.contains(e.target)) {
        Dropdown.close(activeDropdown);
    }
});

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

/**
 * Registered keyboard shortcuts
 * @type {Map<string, Object>}
 */
const shortcuts = new Map();

/**
 * Keyboard shortcut system
 */
export const Keyboard = {
    /**
     * Registers a keyboard shortcut
     * @param {string} key - Key combination (e.g., 'ctrl+k', 'n', '1')
     * @param {Object} options - Shortcut options
     */
    register(key, { handler, description = '', global = false }) {
        shortcuts.set(key.toLowerCase(), { handler, description, global });
    },

    /**
     * Unregisters a keyboard shortcut
     * @param {string} key - Key combination
     */
    unregister(key) {
        shortcuts.delete(key.toLowerCase());
    },

    /**
     * Gets all registered shortcuts
     * @returns {Array} Shortcuts list
     */
    getAll() {
        return Array.from(shortcuts.entries()).map(([key, options]) => ({
            key,
            ...options
        }));
    },

    /**
     * Initializes keyboard shortcut listener
     */
    init() {
        document.addEventListener('keydown', (e) => {
            // Skip if in input
            const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
            const isEditable = e.target.isContentEditable;

            // Build key string
            let key = '';
            if (e.ctrlKey || e.metaKey) key += 'ctrl+';
            if (e.shiftKey) key += 'shift+';
            if (e.altKey) key += 'alt+';
            key += e.key.toLowerCase();

            const shortcut = shortcuts.get(key) || shortcuts.get(e.key.toLowerCase());

            if (shortcut) {
                // Skip non-global shortcuts in inputs
                if ((isInput || isEditable) && !shortcut.global) {
                    return;
                }

                e.preventDefault();
                shortcut.handler(e);
            }
        });
    }
};

// ============================================================================
// THEME MANAGEMENT
// ============================================================================

/**
 * Theme management
 */
export const Theme = {
    /**
     * Gets the current theme
     * @returns {string} Current theme
     */
    get() {
        return getState('ui.theme') || 'system';
    },

    /**
     * Sets the theme
     * @param {'light'|'dark'|'system'} theme - Theme to set
     */
    async set(theme) {
        await setState('ui.theme', theme);
        this.apply(theme);
    },

    /**
     * Toggles between light and dark
     */
    async toggle() {
        const current = this.get();
        const next = current === 'dark' ? 'light' : 'dark';
        await this.set(next);
    },

    /**
     * Applies a theme to the document
     * @param {string} theme - Theme to apply
     */
    apply(theme) {
        const root = document.documentElement;

        if (theme === 'system') {
            root.removeAttribute('data-theme');
        } else {
            root.setAttribute('data-theme', theme);
        }

        // Update meta theme-color
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            const isDark = theme === 'dark' || 
                (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
            meta.content = isDark ? '#1E293B' : '#4F46E5';
        }
    },

    /**
     * Initializes theme based on saved preference
     */
    init() {
        const saved = this.get();
        this.apply(saved);

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (this.get() === 'system') {
                this.apply('system');
            }
        });
    }
};

// ============================================================================
// BROWSER NOTIFICATIONS
// ============================================================================

const LS_NOTIFICATION_QUIET = 'taskflow_notification_quiet_22_7';

/** Suppress non-critical notifications during overnight hours (dissertation: wellbeing). */
export function setNotificationQuietHours(enabled) {
    if (enabled) {
        localStorage.setItem(LS_NOTIFICATION_QUIET, '1');
    } else {
        localStorage.removeItem(LS_NOTIFICATION_QUIET);
    }
}

export function isNotificationQuietHoursEnabled() {
    return localStorage.getItem(LS_NOTIFICATION_QUIET) === '1';
}

/** Local time 22:00–07:00 */
export function isInsideDefaultQuietHours() {
    const h = new Date().getHours();
    return h >= 22 || h < 7;
}

/**
 * Browser notification system
 */
export const Notifications = {
    /**
     * Checks if notifications are supported
     * @returns {boolean}
     */
    isSupported() {
        return 'Notification' in window;
    },

    /**
     * Gets current permission status
     * @returns {string}
     */
    getPermission() {
        return this.isSupported() ? Notification.permission : 'denied';
    },

    /**
     * Requests notification permission
     * @returns {Promise<string>}
     */
    async requestPermission() {
        if (!this.isSupported()) return 'denied';
        return Notification.requestPermission();
    },

    /**
     * Shows a browser notification
     * @param {string} title - Notification title
     * @param {Object} options - Notification options
     * @returns {Notification|null}
     */
    show(title, options = {}) {
        if (!this.isSupported() || this.getPermission() !== 'granted') {
            return null;
        }

        if (isNotificationQuietHoursEnabled() && isInsideDefaultQuietHours()) {
            console.log('[Notifications] Skipped during quiet hours:', title);
            return null;
        }

        const notification = new Notification(title, {
            icon: '/assets/icon-192.png',
            badge: '/assets/icon-72.png',
            ...options
        });

        notification.onclick = () => {
            window.focus();
            options.onClick?.();
            notification.close();
        };

        return notification;
    }
};

// ============================================================================
// AVATAR COMPONENT
// ============================================================================

/**
 * Creates an avatar element
 * @param {Object} options - Avatar options
 * @returns {string} HTML string
 */
export function createAvatar({ name, email, size = '', src = null }) {
    const initials = getInitials(name || email);
    const sizeClass = size ? `avatar--${size}` : '';
    
    if (src) {
        return `
            <div class="avatar ${sizeClass}" title="${escapeHtml(name || email)}">
                <img src="${escapeHtml(src)}" alt="${escapeHtml(name || email)}" />
            </div>
        `;
    }
    
    return `
        <div class="avatar ${sizeClass}" title="${escapeHtml(name || email)}">
            ${escapeHtml(initials)}
        </div>
    `;
}

/**
 * Creates an avatar group from member IDs
 * @param {string[]} memberIds - Array of member IDs
 * @param {number} max - Maximum avatars to show
 * @returns {string} HTML string
 */
export function createAvatarGroup(memberIds, max = 3) {
    if (!memberIds || memberIds.length === 0) return '';

    const members = memberIds
        .map(id => getMember(id))
        .filter(Boolean)
        .slice(0, max);

    const remaining = memberIds.length - max;

    return `
        <div class="avatar-group">
            ${remaining > 0 ? `
                <div class="avatar avatar--sm" title="${remaining} more">+${remaining}</div>
            ` : ''}
            ${members.map(m => createAvatar({ name: m.name, email: m.email, size: 'sm' })).reverse().join('')}
        </div>
    `;
}

// ============================================================================
// SKELETON LOADERS
// ============================================================================

/**
 * Creates a skeleton loader
 * @param {string} type - Skeleton type
 * @param {number} count - Number of skeletons
 * @returns {string} HTML string
 */
export function createSkeleton(type = 'text', count = 1) {
    const skeletons = {
        text: '<div class="skeleton skeleton--text"></div>',
        title: '<div class="skeleton skeleton--title"></div>',
        avatar: '<div class="skeleton skeleton--avatar"></div>',
        card: '<div class="skeleton skeleton--card"></div>',
        taskCard: `
            <div class="card" style="padding: var(--space-4);">
                <div class="skeleton skeleton--text mb-2" style="width: 70%"></div>
                <div class="skeleton skeleton--text mb-3" style="width: 40%"></div>
                <div class="flex gap-2">
                    <div class="skeleton skeleton--avatar"></div>
                    <div class="skeleton" style="width: 60px; height: 20px;"></div>
                </div>
            </div>
        `
    };

    return Array(count).fill(skeletons[type] || skeletons.text).join('');
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize UI components
 */
export function initUI() {
    Toast.init();
    Keyboard.init();
    Theme.init();

    // Register default shortcuts
    Keyboard.register('/', {
        handler: () => document.querySelector('[data-search]')?.focus(),
        description: 'Focus search'
    });

    Keyboard.register('n', {
        handler: () => document.querySelector('[data-quick-add]')?.click(),
        description: 'New task'
    });

    Keyboard.register('1', {
        handler: () => document.querySelector('[data-priority="1"]')?.click(),
        description: 'Set high priority'
    });

    Keyboard.register('2', {
        handler: () => document.querySelector('[data-priority="2"]')?.click(),
        description: 'Set medium priority'
    });

    Keyboard.register('3', {
        handler: () => document.querySelector('[data-priority="3"]')?.click(),
        description: 'Set low priority'
    });

    Keyboard.register('ctrl+k', {
        handler: () => document.querySelector('[data-command-palette]')?.click(),
        description: 'Open command palette',
        global: true
    });

    Keyboard.register('t', {
        handler: () => Theme.toggle(),
        description: 'Toggle theme'
    });

    console.log('[UI] Initialized');
}
