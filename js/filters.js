/**
 * ============================================================================
 * FILTERS.JS - Filtering, Sorting, and Search
 * ============================================================================
 * Task filtering, sorting, and search functionality.
 * @module filters
 */

import { 
    getState, 
    setState, 
    setFilters, 
    clearFilters, 
    getMembers,
    getTasks,
    subscribe,
    TASK_CATEGORIES
} from './state.js';
import { debounce, escapeHtml } from './utils.js';
import { savedViews, recentSearches } from './storage.js';
import { Toast, Modal } from './ui.js';
import { COLUMNS, PRIORITIES } from './board.js';

/**
 * Initializes the filter panel
 * @param {HTMLElement} container - Container element
 */
export function initFilters(container) {
    if (!container) return;

    renderFilterPanel(container);
    subscribe('filters', () => updateFilterUI(container));

    console.log('[Filters] Initialized');
}

/**
 * Renders the filter panel
 * @param {HTMLElement} container - Container element
 */
export function renderFilterPanel(container) {
    const filters = getState('filters');
    const members = getMembers();

    container.innerHTML = `
        <div class="filter-panel">
            <div class="filter-panel__header">
                <h3 class="text-sm font-semibold">Filters</h3>
                <button 
                    class="btn btn--ghost btn--sm" 
                    data-clear-filters
                    ${!hasActiveFilters(filters) ? 'disabled' : ''}
                >
                    Clear all
                </button>
            </div>
            
            <div class="filter-panel__content">
                <!-- Search -->
                <div class="filter-group">
                    <label class="label" for="filter-search">Search</label>
                    <div class="search-input">
                        <svg class="search-input__icon" aria-hidden="true">
                            <use href="#icon-search"></use>
                        </svg>
                        <input 
                            type="text" 
                            id="filter-search" 
                            class="input" 
                            placeholder="Search tasks..."
                            value="${escapeHtml(filters.search || '')}"
                            data-filter="search"
                        >
                        <kbd class="search-input__kbd">/</kbd>
                    </div>
                </div>
                
                <!-- Status Filter -->
                <div class="filter-group">
                    <label class="label">Status</label>
                    <div class="filter-chips">
                        <button 
                            class="filter-chip ${!filters.status ? 'is-active' : ''}" 
                            data-filter="status" 
                            data-value=""
                        >
                            All
                        </button>
                        ${COLUMNS.map(col => `
                            <button 
                                class="filter-chip ${filters.status === col.id ? 'is-active' : ''}" 
                                data-filter="status" 
                                data-value="${col.id}"
                            >
                                <svg class="icon icon--sm" aria-hidden="true">
                                    <use href="#icon-${col.icon}"></use>
                                </svg>
                                ${col.label}
                            </button>
                        `).join('')}
                    </div>
                </div>

                <!-- Category Filter -->
                <div class="filter-group">
                    <label class="label">Category</label>
                    <div class="filter-chips">
                        <button 
                            class="filter-chip ${!filters.category ? 'is-active' : ''}" 
                            data-filter="category" 
                            data-value=""
                        >
                            All
                        </button>
                        ${TASK_CATEGORIES.map(c => `
                            <button 
                                class="filter-chip ${filters.category === c.id ? 'is-active' : ''}" 
                                data-filter="category" 
                                data-value="${c.id}"
                            >
                                ${c.label}
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Priority Filter -->
                <div class="filter-group">
                    <label class="label">Priority</label>
                    <div class="filter-chips">
                        <button 
                            class="filter-chip ${!filters.priority ? 'is-active' : ''}" 
                            data-filter="priority" 
                            data-value=""
                        >
                            All
                        </button>
                        ${Object.entries(PRIORITIES).map(([val, p]) => `
                            <button 
                                class="filter-chip ${filters.priority === parseInt(val) ? 'is-active' : ''}" 
                                data-filter="priority" 
                                data-value="${val}"
                            >
                                <span class="filter-chip__dot filter-chip__dot--${p.color}"></span>
                                ${p.label}
                            </button>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Assignee Filter -->
                <div class="filter-group">
                    <label class="label">Assignee</label>
                    <select class="input select" data-filter="assignee">
                        <option value="">All assignees</option>
                        ${members.map(m => `
                            <option value="${m.id}" ${filters.assignee === m.id ? 'selected' : ''}>
                                ${escapeHtml(m.name)}
                            </option>
                        `).join('')}
                    </select>
                </div>
                
                <!-- Sort -->
                <div class="filter-group">
                    <label class="label">Sort by</label>
                    <div class="flex gap-2">
                        <select class="input select flex-1" data-filter="sortBy">
                            <option value="createdAt" ${filters.sortBy === 'createdAt' ? 'selected' : ''}>Created date</option>
                            <option value="updatedAt" ${filters.sortBy === 'updatedAt' ? 'selected' : ''}>Updated date</option>
                            <option value="dueDate" ${filters.sortBy === 'dueDate' ? 'selected' : ''}>Due date</option>
                            <option value="priority" ${filters.sortBy === 'priority' ? 'selected' : ''}>Priority</option>
                            <option value="title" ${filters.sortBy === 'title' ? 'selected' : ''}>Title</option>
                        </select>
                        <button 
                            class="btn btn--secondary btn--icon" 
                            data-toggle-direction
                            aria-label="Toggle sort direction"
                            title="${filters.sortDirection === 'asc' ? 'Ascending' : 'Descending'}"
                        >
                            <svg class="icon ${filters.sortDirection === 'desc' ? '' : 'rotate-180'}" aria-hidden="true">
                                <use href="#icon-sort"></use>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            
            <!-- Saved Views -->
            <div class="filter-panel__footer">
                <button class="btn btn--ghost btn--sm w-full" data-save-view>
                    <svg class="icon icon--sm" aria-hidden="true">
                        <use href="#icon-save"></use>
                    </svg>
                    Save current view
                </button>
            </div>
        </div>
    `;

    attachFilterListeners(container);
}

/**
 * Attaches event listeners to filter controls
 * @param {HTMLElement} container - Container element
 */
function attachFilterListeners(container) {
    // Search input with debounce
    const searchInput = container.querySelector('[data-filter="search"]');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(async (e) => {
            await setFilters({ search: e.target.value });
            if (e.target.value.trim()) {
                recentSearches.add(e.target.value.trim());
            }
        }, 300));
    }

    // Filter chips (status, priority)
    container.addEventListener('click', async (e) => {
        const chip = e.target.closest('.filter-chip');
        if (chip) {
            const filter = chip.dataset.filter;
            let value = chip.dataset.value;

            // Convert to proper type
            if (filter === 'priority' && value) {
                value = parseInt(value);
            }
            if (!value) value = null;

            await setFilters({ [filter]: value });
        }

        // Clear filters
        if (e.target.closest('[data-clear-filters]')) {
            await clearFilters();
            Toast.info('Filters cleared', 'Showing all tasks');
        }

        // Toggle sort direction
        if (e.target.closest('[data-toggle-direction]')) {
            const current = getState('filters.sortDirection');
            await setFilters({ sortDirection: current === 'asc' ? 'desc' : 'asc' });
        }

        // Save view
        if (e.target.closest('[data-save-view]')) {
            openSaveViewModal();
        }
    });

    // Select filters
    container.querySelectorAll('select[data-filter]').forEach(select => {
        select.addEventListener('change', async (e) => {
            const filter = e.target.dataset.filter;
            let value = e.target.value;

            if (!value) value = null;

            await setFilters({ [filter]: value });
        });
    });
}

/**
 * Updates filter UI based on current state
 * @param {HTMLElement} container - Container element
 */
function updateFilterUI(container) {
    const filters = getState('filters');

    // Update active chip states
    container.querySelectorAll('.filter-chip').forEach(chip => {
        const filter = chip.dataset.filter;
        let value = chip.dataset.value;

        if (filter === 'priority' && value) {
            value = parseInt(value);
        }
        if (!value) value = null;

        chip.classList.toggle('is-active', filters[filter] === value);
    });

    // Update select values
    container.querySelectorAll('select[data-filter]').forEach(select => {
        const filter = select.dataset.filter;
        select.value = filters[filter] || '';
    });

    // Update sort direction icon
    const sortBtn = container.querySelector('[data-toggle-direction]');
    if (sortBtn) {
        const icon = sortBtn.querySelector('.icon');
        icon?.classList.toggle('rotate-180', filters.sortDirection === 'asc');
        sortBtn.title = filters.sortDirection === 'asc' ? 'Ascending' : 'Descending';
    }

    // Update clear button state
    const clearBtn = container.querySelector('[data-clear-filters]');
    if (clearBtn) {
        clearBtn.disabled = !hasActiveFilters(filters);
    }
}

/**
 * Checks if there are active filters
 * @param {Object} filters - Filter state
 * @returns {boolean}
 */
function hasActiveFilters(filters) {
    return !!(
        filters.status ||
        filters.priority ||
        filters.assignee ||
        filters.category ||
        filters.search
    );
}

// ============================================================================
// SAVED VIEWS
// ============================================================================

/**
 * Opens the save view modal
 */
async function openSaveViewModal() {
    const filters = getState('filters');

    const content = `
        <form id="save-view-form" class="form">
            <div class="form-group">
                <label class="label label--required" for="view-name">View Name</label>
                <input 
                    type="text" 
                    id="view-name" 
                    class="input" 
                    placeholder="e.g., High Priority Tasks"
                    required
                >
            </div>
            <div class="form-group">
                <p class="text-sm text-tertiary">
                    This will save your current filter settings:
                </p>
                <ul class="mt-2 text-sm">
                    ${filters.status ? `<li>Status: ${COLUMNS.find(c => c.id === filters.status)?.label}</li>` : ''}
                    ${filters.priority ? `<li>Priority: ${PRIORITIES[filters.priority]?.label}</li>` : ''}
                    ${filters.category ? `<li>Category: ${TASK_CATEGORIES.find(c => c.id === filters.category)?.label ?? filters.category}</li>` : ''}
                    ${filters.assignee ? `<li>Assignee filter active</li>` : ''}
                    ${filters.search ? `<li>Search: "${filters.search}"</li>` : ''}
                    <li>Sort: ${filters.sortBy} (${filters.sortDirection})</li>
                </ul>
            </div>
        </form>
    `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
        <button type="button" class="btn btn--secondary" data-dismiss>Cancel</button>
        <button type="submit" form="save-view-form" class="btn btn--primary">Save View</button>
    `;

    const modal = Modal.open({
        title: 'Save View',
        content,
        footer
    });

    const form = modal.querySelector('#save-view-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = form.querySelector('#view-name').value.trim();

        if (!name) return;

        await savedViews.save({
            name,
            filters: { ...filters }
        });

        Modal.close(modal);
        Toast.success('View saved', `"${name}" has been saved`);
    });

    footer.querySelector('[data-dismiss]').addEventListener('click', () => {
        Modal.close(modal);
    });
}

/**
 * Opens saved views list
 * @param {HTMLElement} triggerElement - Trigger element for positioning
 */
export async function openSavedViewsList(triggerElement) {
    const views = await savedViews.getAll();

    if (views.length === 0) {
        Toast.info('No saved views', 'Save your current filters to create a view');
        return;
    }

    const content = `
        <ul class="saved-views-list">
            ${views.map(view => `
                <li class="saved-view-item">
                    <button class="saved-view-item__btn" data-apply-view="${view.id}">
                        <svg class="icon icon--sm" aria-hidden="true">
                            <use href="#icon-eye"></use>
                        </svg>
                        <span>${escapeHtml(view.name)}</span>
                    </button>
                    <button 
                        class="btn btn--ghost btn--icon btn--sm" 
                        data-delete-view="${view.id}"
                        aria-label="Delete view"
                    >
                        <svg class="icon icon--sm" aria-hidden="true">
                            <use href="#icon-trash"></use>
                        </svg>
                    </button>
                </li>
            `).join('')}
        </ul>
    `;

    const modal = Modal.open({
        title: 'Saved Views',
        content
    });

    modal.addEventListener('click', async (e) => {
        const applyBtn = e.target.closest('[data-apply-view]');
        const deleteBtn = e.target.closest('[data-delete-view]');

        if (applyBtn) {
            const viewId = applyBtn.dataset.applyView;
            const view = views.find(v => v.id === viewId);
            if (view) {
                await setFilters(view.filters);
                Modal.close(modal);
                Toast.success('View applied', `"${view.name}" filters applied`);
            }
        }

        if (deleteBtn) {
            const viewId = deleteBtn.dataset.deleteView;
            const view = views.find(v => v.id === viewId);
            const confirmed = await Modal.confirm({
                title: 'Delete View',
                message: `Delete "${view?.name}"?`,
                confirmText: 'Delete',
                danger: true
            });

            if (confirmed) {
                await savedViews.delete(viewId);
                deleteBtn.closest('.saved-view-item')?.remove();
                Toast.success('Deleted', 'View has been removed');
            }
        }
    });
}

// ============================================================================
// GLOBAL SEARCH
// ============================================================================

/**
 * Opens the global search modal (command palette style)
 */
export function openGlobalSearch() {
    const content = document.createElement('div');
    content.className = 'global-search';
    content.innerHTML = `
        <div class="global-search__input-wrapper">
            <svg class="icon text-tertiary" aria-hidden="true">
                <use href="#icon-search"></use>
            </svg>
            <input 
                type="text" 
                class="global-search__input" 
                placeholder="Search tasks, projects, or type a command..."
                autofocus
            >
            <kbd class="global-search__kbd">ESC</kbd>
        </div>
        <div class="global-search__results"></div>
        <div class="global-search__footer">
            <span class="text-xs text-tertiary">
                <kbd>↑↓</kbd> Navigate
                <kbd>↵</kbd> Select
                <kbd>ESC</kbd> Close
            </span>
        </div>
    `;

    const modal = Modal.open({
        title: '',
        content,
        size: 'lg',
        closable: true
    });

    // Remove default modal padding for search
    modal.querySelector('.modal__header')?.remove();
    modal.querySelector('.modal__body').style.padding = '0';

    const input = content.querySelector('.global-search__input');
    const resultsContainer = content.querySelector('.global-search__results');

    // Handle search input
    input.addEventListener('input', debounce(async (e) => {
        const query = e.target.value.trim();

        if (!query) {
            resultsContainer.innerHTML = renderRecentSearches();
            return;
        }

        const results = searchAll(query);
        resultsContainer.innerHTML = renderSearchResults(results, query);
    }, 150));

    // Handle keyboard navigation
    let selectedIndex = -1;
    input.addEventListener('keydown', (e) => {
        const items = resultsContainer.querySelectorAll('.search-result');

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateSelectedResult(items, selectedIndex);
                break;
            case 'ArrowUp':
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateSelectedResult(items, selectedIndex);
                break;
            case 'Enter':
                e.preventDefault();
                const selected = items[selectedIndex];
                if (selected) {
                    selected.click();
                }
                break;
        }
    });

    // Handle result clicks
    resultsContainer.addEventListener('click', async (e) => {
        const result = e.target.closest('.search-result');
        if (!result) return;

        const type = result.dataset.type;
        const id = result.dataset.id;

        Modal.close(modal);

        if (type === 'task') {
            import('./board.js').then(({ openTaskDetailModal }) => {
                openTaskDetailModal(id);
            });
        } else if (type === 'member') {
            await setFilters({ assignee: id });
            Toast.info('Filtered by assignee', 'Showing tasks for this teammate');
        } else if (type === 'recent') {
            const query = result.dataset.query;
            await setFilters({ search: query });
        }
    });

    // Show recent searches initially
    resultsContainer.innerHTML = renderRecentSearches();
}

/**
 * Searches all entities
 * @param {string} query - Search query
 * @returns {Object} Search results
 */
function searchAll(query) {
    const normalizedQuery = query.toLowerCase();

    const tasks = getTasks().filter(t => {
        const title = (t.title ?? '').toLowerCase();
        const desc = (t.description ?? '').toLowerCase();
        return title.includes(normalizedQuery) || desc.includes(normalizedQuery);
    });

    const members = getMembers().filter(m => {
        const name = (m.name ?? '').toLowerCase();
        const email = (m.email ?? '').toLowerCase();
        return name.includes(normalizedQuery) || email.includes(normalizedQuery);
    });

    return { tasks, members };
}

/**
 * Renders search results
 * @param {Object} results - Search results
 * @param {string} query - Search query
 * @returns {string} HTML string
 */
function renderSearchResults(results, query) {
    const { tasks, members } = results;

    if (tasks.length === 0 && members.length === 0) {
        return `
            <div class="global-search__empty">
                <svg class="icon icon--xl text-disabled" aria-hidden="true">
                    <use href="#icon-search"></use>
                </svg>
                <p class="text-secondary mt-2">No results for "${escapeHtml(query)}"</p>
            </div>
        `;
    }

    let html = '';

    if (tasks.length > 0) {
        html += `
            <div class="search-group">
                <div class="search-group__header">Tasks</div>
                ${tasks.slice(0, 5).map(task => `
                    <button class="search-result" data-type="task" data-id="${task.id}">
                        <svg class="icon icon--sm text-tertiary" aria-hidden="true">
                            <use href="#icon-${task.status === 'done' ? 'check-circle' : 'layers'}"></use>
                        </svg>
                        <div class="search-result__content">
                            <span class="search-result__title">${highlightMatch(task.title, query)}</span>
                            <span class="search-result__meta">${COLUMNS.find(c => c.id === task.status)?.label}</span>
                        </div>
                    </button>
                `).join('')}
                ${tasks.length > 5 ? `<p class="text-xs text-tertiary px-4 py-2">+${tasks.length - 5} more results</p>` : ''}
            </div>
        `;
    }

    if (members.length > 0) {
        html += `
            <div class="search-group">
                <div class="search-group__header">People</div>
                ${members.slice(0, 3).map(member => `
                    <button class="search-result" data-type="member" data-id="${member.id}">
                        <div class="avatar avatar--sm">${escapeHtml((member.name || '?').charAt(0))}</div>
                        <div class="search-result__content">
                            <span class="search-result__title">${highlightMatch(member.name, query)}</span>
                            <span class="search-result__meta">${escapeHtml(member.email)}</span>
                        </div>
                    </button>
                `).join('')}
            </div>
        `;
    }

    return html;
}

/**
 * Renders recent searches
 * @returns {string} HTML string
 */
function renderRecentSearches() {
    // Get from storage synchronously using cached data
    const searches = JSON.parse(localStorage.getItem('taskflow_recentSearches') || '[]');

    if (searches.length === 0) {
        return `
            <div class="global-search__hint">
                <p class="text-sm text-tertiary">Start typing to search tasks, people, or projects</p>
                <div class="mt-4">
                    <p class="text-xs text-tertiary mb-2">Quick actions:</p>
                    <div class="flex flex-wrap gap-2">
                        <kbd>N</kbd> New task
                        <kbd>1-3</kbd> Set priority
                        <kbd>T</kbd> Toggle theme
                    </div>
                </div>
            </div>
        `;
    }

    return `
        <div class="search-group">
            <div class="search-group__header">Recent Searches</div>
            ${searches.map(query => `
                <button class="search-result" data-type="recent" data-query="${escapeHtml(query)}">
                    <svg class="icon icon--sm text-tertiary" aria-hidden="true">
                        <use href="#icon-clock"></use>
                    </svg>
                    <span class="search-result__title">${escapeHtml(query)}</span>
                </button>
            `).join('')}
        </div>
    `;
}

/**
 * Highlights matching text
 * @param {string} text - Text to highlight
 * @param {string} query - Search query
 * @returns {string} HTML string with highlights
 */
function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);

    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return escapeHtml(text).replace(regex, '<mark>$1</mark>');
}

/**
 * Escapes regex special characters
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Updates selected result styling
 * @param {NodeList} items - Result items
 * @param {number} index - Selected index
 */
function updateSelectedResult(items, index) {
    items.forEach((item, i) => {
        item.classList.toggle('is-selected', i === index);
    });

    items[index]?.scrollIntoView({ block: 'nearest' });
}
