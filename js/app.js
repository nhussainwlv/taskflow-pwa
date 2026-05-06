/**
 * ============================================================================
 * APP.JS - Main Application Entry Point
 * ============================================================================
 * Initialises all modules and sets up the application.
 * @module app
 */

import { initState, getTasks, subscribe, getState, setState, setView } from './state.js';
import { initUI, Toast, Modal, Theme, Keyboard, Notifications } from './ui.js';
import { initBoard, openQuickAddModal, COLUMNS } from './board.js';
import { initFilters, openGlobalSearch, openSavedViewsList } from './filters.js';
import { openInviteMemberModal } from './email.js';
import { initChatbot } from './chatbot.js';
import { formatDate, debounce } from './utils.js';
import { initAuth, isAuthenticated, getCurrentUser, onAuthStateChange, openSignInModal, openSignUpModal, openProfileModal, signOut, getUserInitials } from './auth.js';
import { startDemo } from './demo.js';
import { initA11yUx, announce, registerA11yPanelExtras } from './a11y-ux.js';
import { attachAccessibilityPanelExtras, initAccessibilityExtras } from './accessibility-extras.js';
import { initInstallEngagementTracking } from './engagement.js';
import { initInstallPrompt, maybePromptInstallAfterSignin } from './install-prompt.js';

/**
 * Application initialisation
 */
async function init() {
    console.log('[TaskFlow] Starting initialisation...');

    try {
        initInstallPrompt();

        // Initialise authentication first
        await initAuth();
        initInstallEngagementTracking();
        await maybePromptInstallAfterSignin();
        console.log('[TaskFlow] Auth initialised');

        // Initialise state (loads from storage or seeds demo data)
        await initState();
        console.log('[TaskFlow] State initialised');

        // Initialise UI components
        initUI();
        console.log('[TaskFlow] UI initialised');

        registerA11yPanelExtras(attachAccessibilityPanelExtras);
        initAccessibilityExtras();

        initA11yUx();
        console.log('[TaskFlow] A11y / evaluation UX initialised');

        // Update auth-dependent UI
        updateAuthUI();

        // Set up auth state listener
        onAuthStateChange(() => {
            updateAuthUI();
        });

        // Wire buttons (Sign In, filters, etc.) before board — board init must never block this
        setupEventListeners();
        console.log('[TaskFlow] Event listeners attached');

        // Only initialise board if authenticated
        if (isAuthenticated()) {
            const boardContainer = document.getElementById('board');
            if (boardContainer) {
                try {
                    initBoard(boardContainer);
                    syncBoardViewToolbar();
                    subscribe('ui.view', syncBoardViewToolbar);
                    console.log('[TaskFlow] Board initialised');
                } catch (boardErr) {
                    console.error('[TaskFlow] Board initialisation failed:', boardErr);
                    Toast.warning('Board', 'Could not render tasks. Try Filters → Clear all, or refresh the page.');
                }
            }

            try {
                updateStats();
                updateAgenda();
            } catch (statsErr) {
                console.error('[TaskFlow] Stats update failed:', statsErr);
            }
        }

        // Initialise chatbot
        initChatbot();
        console.log('[TaskFlow] Chatbot initialised');

        // Update today's date
        updateTodayDate();

        // Subscribe to state changes
        subscribe('tasks', () => {
            updateStats();
            updateAgenda();
        });

        // Request notification permission if not already granted
        if (Notifications.isSupported() && Notifications.getPermission() === 'default') {
            // Don't ask immediately, wait for user interaction
        }

        console.log('[TaskFlow] Initialisation complete!');

    } catch (error) {
        console.error('[TaskFlow] Initialisation failed:', error);
        try {
            Toast.error('Initialisation Error', 'Failed to load application. Please refresh.');
        } catch (_) {
            /* ignore if Toast could not initialise */
        }
    } finally {
        document.querySelectorAll('.board-loading').forEach(el => el.remove());
    }
}

/**
 * Updates UI based on authentication state
 */
function syncBoardViewToolbar() {
    const mode = getState('ui.view') || 'kanban';
    document.querySelectorAll('[data-view-mode]').forEach(btn => {
        const active = btn.getAttribute('data-view-mode') === mode;
        btn.setAttribute('aria-pressed', active ? 'true' : 'false');
        btn.classList.toggle('btn--secondary', active);
        btn.classList.toggle('btn--ghost', !active);
    });
}

function updateAuthUI() {
    const authenticated = isAuthenticated();
    const user = getCurrentUser();

    // Update elements that require authentication
    document.querySelectorAll('[data-requires-auth]').forEach(el => {
        el.hidden = !authenticated;
    });

    // Update elements shown when signed out
    document.querySelectorAll('[data-show-signed-out]').forEach(el => {
        el.hidden = authenticated;
    });

    // Update elements shown when signed in
    document.querySelectorAll('[data-show-signed-in]').forEach(el => {
        el.hidden = !authenticated;
    });

    // Update user initials
    if (authenticated && user) {
        document.querySelectorAll('[data-user-initials]').forEach(el => {
            el.textContent = getUserInitials();
        });
    }

    console.log('[TaskFlow] Auth UI updated:', authenticated ? 'signed in' : 'signed out');
}

/**
 * Sets up global event listeners
 */
function setupEventListeners() {
    document.querySelectorAll('.header__logo, .footer__logo').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const path = window.location.pathname || '';
            if (!path.endsWith('/html/index.html')) {
                window.location.assign('html/index.html');
                return;
            }
            // If already on home page, ensure users are returned to the top.
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // Quick add task button
    document.querySelectorAll('[data-quick-add]').forEach(btn => {
        btn.addEventListener('click', () => openQuickAddModal());
    });

    // Theme toggle
    document.querySelectorAll('[data-theme-toggle], [data-theme-toggle-global]').forEach(btn => {
        btn.addEventListener('click', () => Theme.toggle());
    });

    // Command palette / global search
    document.querySelectorAll('[data-command-palette]').forEach(btn => {
        btn.addEventListener('click', () => openGlobalSearch());
    });

    // Invite member
    document.querySelectorAll('[data-invite-member]').forEach(btn => {
        btn.addEventListener('click', () => openInviteMemberModal());
    });

    // Auth buttons
    document.querySelectorAll('[data-open-signin]').forEach(btn => {
        btn.addEventListener('click', () => openSignInModal());
    });

    document.querySelectorAll('[data-open-signup]').forEach(btn => {
        btn.addEventListener('click', () => openSignUpModal());
    });

    // Demo button
    document.querySelectorAll('[data-start-demo]').forEach(btn => {
        btn.addEventListener('click', () => startDemo());
    });

    // Notifications button
    document.querySelectorAll('[data-notifications]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (Notifications.getPermission() === 'default') {
                const permission = await Notifications.requestPermission();
                if (permission === 'granted') {
                    Toast.success('Notifications enabled', 'You will receive task reminders');
                }
            } else if (Notifications.getPermission() === 'granted') {
                Toast.info('Notifications', 'You will be notified about upcoming tasks');
            } else {
                Toast.warning('Notifications blocked', 'Enable notifications in your browser settings');
            }
        });
    });

    // Filter panel toggle
    const filterPanel = document.getElementById('filter-panel');
    document.querySelectorAll('[data-open-filters]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (filterPanel) {
                const isHidden = filterPanel.hidden;
                filterPanel.hidden = !isHidden;
                if (!isHidden) {
                    // Re-initialise filters when opening
                    import('./filters.js').then(({ initFilters }) => {
                        initFilters(filterPanel);
                    });
                }
            }
        });
    });

    // Saved views
    document.querySelectorAll('[data-open-saved-views]').forEach(btn => {
        btn.addEventListener('click', () => openSavedViewsList(btn));
    });

    // Search input
    const searchInput = document.querySelector('[data-search]');
    if (searchInput) {
        searchInput.addEventListener('focus', () => {
            openGlobalSearch();
        });
    }

    // Register keyboard shortcuts
    Keyboard.register('ctrl+k', {
        handler: () => openGlobalSearch(),
        description: 'Open command palette',
        global: true
    });

    Keyboard.register('n', {
        handler: () => {
            if (isAuthenticated()) openQuickAddModal();
        },
        description: 'New task'
    });

    Keyboard.register('t', {
        handler: () => Theme.toggle(),
        description: 'Toggle theme'
    });

    Keyboard.register('?', {
        handler: () => showKeyboardShortcuts(),
        description: 'Show keyboard shortcuts'
    });

    // Profile dropdown
    setupProfileDropdown();

    document.querySelectorAll('[data-view-mode]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const mode = btn.getAttribute('data-view-mode');
            await setView(mode);
            syncBoardViewToolbar();
            announce(`Showing ${mode} view`);
        });
    });

    // Handle window resize for responsive adjustments
    window.addEventListener('resize', debounce(() => {
        // Any responsive adjustments can go here
    }, 250));
}

/**
 * Updates the stats display
 */
function updateStats() {
    const tasks = getTasks();

    const stats = {
        total: tasks.length,
        'in-progress': tasks.filter(t => t.status === 'in-progress').length,
        done: tasks.filter(t => t.status === 'done').length,
        overdue: tasks.filter(t => 
            t.dueDate && 
            new Date(t.dueDate) < new Date() && 
            t.status !== 'done'
        ).length
    };

    // Update stat cards
    Object.entries(stats).forEach(([key, value]) => {
        const el = document.querySelector(`[data-stat="${key}"]`);
        if (el) {
            el.textContent = value;
        }
    });

    // Update task count badge
    const taskCount = document.querySelector('[data-task-count]');
    if (taskCount) {
        taskCount.textContent = `${stats.total} task${stats.total !== 1 ? 's' : ''}`;
    }
}

/**
 * Updates the today's agenda section
 */
function updateAgenda() {
    const agendaList = document.getElementById('agenda-list');
    if (!agendaList) return;

    const tasks = getTasks();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's tasks and upcoming (next 3 days)
    const todayTasks = tasks.filter(t => {
        if (!t.dueDate || t.status === 'done') return false;
        const dueDate = new Date(t.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() === today.getTime();
    });

    const upcomingTasks = tasks.filter(t => {
        if (!t.dueDate || t.status === 'done') return false;
        const dueDate = new Date(t.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const endDate = new Date(today);
        endDate.setDate(endDate.getDate() + 3);
        return dueDate > today && dueDate <= endDate;
    });

    const overdueTasks = tasks.filter(t => {
        if (!t.dueDate || t.status === 'done') return false;
        const dueDate = new Date(t.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate < today;
    });

    if (todayTasks.length === 0 && upcomingTasks.length === 0 && overdueTasks.length === 0) {
        agendaList.innerHTML = `
            <div class="agenda__empty">
                <svg class="icon icon--xl" aria-hidden="true">
                    <use href="#icon-check-circle"></use>
                </svg>
                <p class="mt-2">You're all caught up! No tasks due soon.</p>
            </div>
        `;
        return;
    }

    let html = '';

    // Overdue section
    if (overdueTasks.length > 0) {
        html += `<h4 class="text-sm font-semibold text-danger-600 mb-2">Overdue (${overdueTasks.length})</h4>`;
        html += overdueTasks.slice(0, 3).map(t => renderAgendaItem(t, true)).join('');
    }

    // Today section
    if (todayTasks.length > 0) {
        html += `<h4 class="text-sm font-semibold mt-4 mb-2">Today (${todayTasks.length})</h4>`;
        html += todayTasks.map(t => renderAgendaItem(t)).join('');
    }

    // Upcoming section
    if (upcomingTasks.length > 0) {
        html += `<h4 class="text-sm font-semibold text-tertiary mt-4 mb-2">Upcoming (${upcomingTasks.length})</h4>`;
        html += upcomingTasks.slice(0, 5).map(t => renderAgendaItem(t)).join('');
    }

    agendaList.innerHTML = html;

    // Attach checkbox listeners
    agendaList.querySelectorAll('[data-agenda-complete]').forEach(checkbox => {
        checkbox.addEventListener('change', async (e) => {
            const taskId = e.target.dataset.agendaComplete;
            const { moveTask } = await import('./state.js');
            await moveTask(taskId, 'done');
            Toast.success('Task completed!');
        });
    });
}

/**
 * Renders an agenda item
 * @param {Object} task - Task object
 * @param {boolean} isOverdue - Whether the task is overdue
 * @returns {string} HTML string
 */
function renderAgendaItem(task, isOverdue = false) {
    const priorityColors = {
        1: 'var(--color-danger-500)',
        2: 'var(--color-warning-500)',
        3: 'var(--color-gray-400)'
    };

    return `
        <div class="agenda-item">
            <label class="checkbox agenda-item__checkbox">
                <input type="checkbox" data-agenda-complete="${task.id}">
            </label>
            <div class="agenda-item__content">
                <span class="agenda-item__title">${task.title}</span>
                <span class="agenda-item__meta">
                    <span style="color: ${priorityColors[task.priority]}">●</span>
                    ${task.dueDate ? formatDate(task.dueDate) : 'No due date'}
                </span>
            </div>
        </div>
    `;
}

/**
 * Updates today's date display
 */
function updateTodayDate() {
    const el = document.getElementById('today-date');
    if (el) {
        el.textContent = new Date().toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long'
        });
    }
}

/**
 * Sets up the profile dropdown
 */
function setupProfileDropdown() {
    const dropdown = document.querySelector('[data-profile-dropdown]');
    if (!dropdown) return;

    const trigger = dropdown.querySelector('[data-dropdown-trigger]');
    if (!trigger) return;

    // Create menu
    const menu = document.createElement('div');
    menu.className = 'dropdown__menu dropdown__menu--right';
    menu.innerHTML = `
        <div class="dropdown__user-info" data-user-email></div>
        <div class="dropdown__divider"></div>
        <button class="dropdown__item" data-action="profile">
            <svg class="icon icon--sm" aria-hidden="true"><use href="#icon-user"></use></svg>
            Profile
        </button>
        <button class="dropdown__item" data-action="settings">
            <svg class="icon icon--sm" aria-hidden="true"><use href="#icon-settings"></use></svg>
            Settings
        </button>
        <div class="dropdown__divider"></div>
        <button class="dropdown__item" data-action="shortcuts">
            <svg class="icon icon--sm" aria-hidden="true"><use href="#icon-zap"></use></svg>
            Keyboard Shortcuts
        </button>
        <button class="dropdown__item" data-action="export">
            <svg class="icon icon--sm" aria-hidden="true"><use href="#icon-save"></use></svg>
            Export Data
        </button>
        <div class="dropdown__divider"></div>
        <button class="dropdown__item dropdown__item--danger" data-action="signout">
            <svg class="icon icon--sm" aria-hidden="true"><use href="#icon-log-out"></use></svg>
            Sign Out
        </button>
    `;
    dropdown.appendChild(menu);

    // Update user email on open
    const updateUserEmail = () => {
        const user = getCurrentUser();
        const emailEl = menu.querySelector('[data-user-email]');
        if (emailEl && user) {
            emailEl.innerHTML = `
                <div class="text-sm font-medium">${user.name || 'User'}</div>
                <div class="text-xs text-tertiary">${user.email}</div>
            `;
        }
    };

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
        e.stopPropagation();
        updateUserEmail();
        dropdown.classList.toggle('is-open');
    });

    // Handle menu items
    menu.addEventListener('click', async (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        dropdown.classList.remove('is-open');

        switch (action) {
            case 'profile':
                openProfileModal();
                break;
            case 'settings':
                import('./a11y-ux.js').then(({ openAccessibilityPanel }) => openAccessibilityPanel());
                break;
            case 'shortcuts':
                showKeyboardShortcuts();
                break;
            case 'export':
                exportData();
                break;
            case 'signout':
                await signOut();
                Toast.success('Signed out', 'See you next time!');
                window.location.reload();
                break;
        }
    });

    // Close on outside click
    document.addEventListener('click', () => {
        dropdown.classList.remove('is-open');
    });
}

/**
 * Shows keyboard shortcuts modal
 */
function showKeyboardShortcuts() {
    const shortcuts = Keyboard.getAll();

    const content = `
        <div class="grid grid-cols-2 gap-4">
            ${shortcuts.map(s => `
                <div class="flex items-center justify-between p-2 rounded bg-muted">
                    <span class="text-sm">${s.description}</span>
                    <kbd class="text-xs px-2 py-1 bg-surface border rounded">${formatShortcut(s.key)}</kbd>
                </div>
            `).join('')}
        </div>
    `;

    Modal.open({
        title: 'Keyboard Shortcuts',
        content,
        size: 'lg'
    });
}

/**
 * Formats a shortcut key for display
 * @param {string} key - Shortcut key
 * @returns {string} Formatted key
 */
function formatShortcut(key) {
    return key
        .replace('ctrl+', '⌘')
        .replace('shift+', '⇧')
        .replace('alt+', '⌥')
        .toUpperCase();
}

/**
 * Exports all data as JSON
 */
async function exportData() {
    const { storage } = await import('./storage.js');
    const data = await storage.exportData();

    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    Toast.success('Export complete', 'Your data has been downloaded');
}

// ============================================================================
// SERVICE WORKER REGISTRATION
// ============================================================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('../sw.js');
            console.log('[TaskFlow] Service Worker registered:', registration.scope);

            navigator.serviceWorker.addEventListener('message', event => {
                if (event.data?.type === 'SYNC_FLUSH') {
                    Toast.info('Back online', 'Local saves are synced to this browser.');
                    announce('Background sync acknowledged your offline work.');
                }
            });

            // Handle updates
            registration.addEventListener('updatefound', () => {
                const newWorker = registration.installing;
                newWorker?.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        Toast.info('Update available', 'Refresh to get the latest version');
                    }
                });
            });
        } catch (error) {
            console.warn('[TaskFlow] Service Worker registration failed:', error);
        }
    });
}

// ============================================================================
// START APPLICATION
// ============================================================================

document.addEventListener('DOMContentLoaded', init);

// Export for debugging
window.TaskFlow = {
    getState,
    setState,
    getTasks,
    Toast,
    Theme
};

console.log('[TaskFlow] App module loaded');
