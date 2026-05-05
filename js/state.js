/**
 * ============================================================================
 * STATE.JS - Application State Management
 * ============================================================================
 * Centralised state management with reactive updates.
 * @module state
 */

import { deepClone, generateId } from './utils.js';
import { storage } from './storage.js';

/**
 * @typedef {Object} Task
 * @property {string} id - Unique task identifier
 * @property {string} title - Task title
 * @property {string} description - Task description (supports basic formatting)
 * @property {'backlog'|'in-progress'|'done'} status - Task status
 * @property {1|2|3} priority - Priority level (1=High, 2=Medium, 3=Low)
 * @property {string|null} dueDate - Due date ISO string
 * @property {string} labelColor - Hex color for task label
 * @property {string[]} assignees - Array of member IDs
 * @property {Object[]} subtasks - Array of subtasks
 * @property {Object[]} attachments - Array of attachment objects
 * @property {Object[]} comments - Array of comment objects
 * @property {string} projectId - Parent project ID
 * @property {string} createdAt - Creation timestamp
 * @property {string} updatedAt - Last update timestamp
 */

/**
 * @typedef {Object} Project
 * @property {string} id - Unique project identifier
 * @property {string} name - Project name
 * @property {string} description - Project description
 * @property {string} color - Project color
 * @property {string} workspaceId - Parent workspace ID
 * @property {string[]} memberIds - Array of member IDs
 * @property {string} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} Workspace
 * @property {string} id - Unique workspace identifier
 * @property {string} name - Workspace name
 * @property {string[]} projectIds - Array of project IDs
 * @property {Object[]} members - Array of member objects with roles
 * @property {string} createdAt - Creation timestamp
 */

/**
 * @typedef {Object} Member
 * @property {string} id - Unique member identifier
 * @property {string} name - Member display name
 * @property {string} email - Member email
 * @property {string} avatar - Avatar URL or initials
 * @property {'owner'|'editor'|'viewer'} role - Member role
 */

/**
 * @typedef {Object} AppState
 * @property {Object} user - Current user info
 * @property {Workspace[]} workspaces - All workspaces
 * @property {Project[]} projects - All projects
 * @property {Task[]} tasks - All tasks
 * @property {Member[]} members - All members
 * @property {string} currentWorkspaceId - Active workspace
 * @property {string} currentProjectId - Active project
 * @property {Object} filters - Current filter settings
 * @property {Object} ui - UI state (modals, theme, etc.)
 */

// Default state structure
const defaultState = {
    user: {
        id: 'user-1',
        name: 'Demo User',
        email: 'demo@taskflow.app',
        avatar: null
    },
    workspaces: [],
    projects: [],
    tasks: [],
    members: [],
    currentWorkspaceId: null,
    currentProjectId: null,
    filters: {
        status: null,
        priority: null,
        assignee: null,
        category: null,
        search: '',
        sortBy: 'createdAt',
        sortDirection: 'desc'
    },
    ui: {
        theme: 'system', // 'light', 'dark', 'system'
        sidebarOpen: true,
        view: 'kanban', // 'kanban', 'list', 'calendar'
        selectedTasks: [],
        editingTask: null,
        modalOpen: null
    },
    settings: {
        notifications: true,
        sounds: false,
        compactMode: false
    }
};

/** Table 4.1 — organise tasks into categories (shared across board + filters). */
export const TASK_CATEGORIES = [
    { id: 'general', label: 'General' },
    { id: 'work', label: 'Work' },
    { id: 'personal', label: 'Personal' },
    { id: 'study', label: 'Study' },
    { id: 'health', label: 'Health' }
];

const CATEGORY_ID_SET = new Set(TASK_CATEGORIES.map(c => c.id));

export function normalizeCategoryId(value) {
    const v = (value && String(value).trim().toLowerCase()) || 'general';
    return CATEGORY_ID_SET.has(v) ? v : 'general';
}

export function getCategoryLabel(categoryId) {
    const id = normalizeCategoryId(categoryId);
    return TASK_CATEGORIES.find(c => c.id === id)?.label ?? 'General';
}

/** Coerce persisted / imported tasks so list filters never throw on missing arrays. */
function normalizeStoredTasks(tasks) {
    if (!Array.isArray(tasks)) return [];
    return tasks.map(t => ({
        ...t,
        category: normalizeCategoryId(t.category),
        assignees: Array.isArray(t.assignees) ? t.assignees : [],
        subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
        attachments: Array.isArray(t.attachments) ? t.attachments : [],
        comments: Array.isArray(t.comments) ? t.comments : []
    }));
}

/**
 * State subscribers for reactive updates
 * @type {Map<string, Set<Function>>}
 */
const subscribers = new Map();

/**
 * Current application state
 * @type {AppState}
 */
let state = deepClone(defaultState);

/**
 * Initializes the application state from storage or seeds demo data
 * @returns {Promise<void>}
 */
export async function initState() {
    const savedState = await storage.get('appState');
    
    if (savedState && savedState.tasks && savedState.tasks.length > 0) {
        state = {
            ...defaultState,
            ...savedState,
            filters: { ...defaultState.filters, ...(savedState.filters && typeof savedState.filters === 'object' ? savedState.filters : {}) },
            ui: { ...defaultState.ui, ...(savedState.ui && typeof savedState.ui === 'object' ? savedState.ui : {}) },
            settings: { ...defaultState.settings, ...(savedState.settings && typeof savedState.settings === 'object' ? savedState.settings : {}) }
        };
        state.tasks = normalizeStoredTasks(state.tasks);
        console.log('[State] Loaded from storage');
    } else {
        // Seed demo data
        seedDemoData();
        await persistState();
        console.log('[State] Initialized with demo data');
    }
    
    notify('init', state);
}

/**
 * Seeds the state with demo data for first-time users
 */
function seedDemoData() {
    const now = new Date().toISOString();
    const tomorrow = new Date(Date.now() + 86400000).toISOString();
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString();
    const yesterday = new Date(Date.now() - 86400000).toISOString();

    // Demo members
    state.members = [
        { id: 'member-1', name: 'Alex Chen', email: 'alex@example.com', avatar: null, role: 'owner' },
        { id: 'member-2', name: 'Sarah Wilson', email: 'sarah@example.com', avatar: null, role: 'editor' },
        { id: 'member-3', name: 'Mike Johnson', email: 'mike@example.com', avatar: null, role: 'editor' },
        { id: 'member-4', name: 'Emma Davis', email: 'emma@example.com', avatar: null, role: 'viewer' }
    ];

    // Demo workspace
    state.workspaces = [{
        id: 'workspace-1',
        name: 'My Workspace',
        projectIds: ['project-1', 'project-2'],
        members: state.members.map(m => ({ id: m.id, role: m.role })),
        createdAt: now
    }];

    // Demo projects
    state.projects = [
        {
            id: 'project-1',
            name: 'Website Redesign',
            description: 'Complete overhaul of company website with new branding',
            color: '#4F46E5',
            workspaceId: 'workspace-1',
            memberIds: ['member-1', 'member-2', 'member-3'],
            createdAt: now
        },
        {
            id: 'project-2',
            name: 'Mobile App Launch',
            description: 'Q2 mobile application release preparation',
            color: '#059669',
            workspaceId: 'workspace-1',
            memberIds: ['member-1', 'member-4'],
            createdAt: now
        }
    ];

    // Demo tasks
    state.tasks = [
        {
            id: 'task-1',
            title: 'Design homepage mockups',
            description: 'Create high-fidelity mockups for the new homepage design including hero section, features grid, and testimonials.',
            status: 'in-progress',
            priority: 1,
            dueDate: tomorrow,
            labelColor: '#4F46E5',
            category: 'study',
            assignees: ['member-2'],
            subtasks: [
                { id: 'st-1', title: 'Hero section', completed: true },
                { id: 'st-2', title: 'Features grid', completed: true },
                { id: 'st-3', title: 'Testimonials', completed: false },
                { id: 'st-4', title: 'Footer design', completed: false }
            ],
            attachments: [],
            comments: [
                { id: 'c-1', authorId: 'member-1', text: 'Looking great so far! Can we add more white space?', createdAt: yesterday }
            ],
            projectId: 'project-1',
            createdAt: now,
            updatedAt: now
        },
        {
            id: 'task-2',
            title: 'Implement responsive navigation',
            description: 'Build the responsive navigation component with mobile hamburger menu and dropdown submenus.',
            status: 'backlog',
            priority: 2,
            dueDate: nextWeek,
            labelColor: '#0891B2',
            category: 'general',
            assignees: ['member-3'],
            subtasks: [],
            attachments: [],
            comments: [],
            projectId: 'project-1',
            createdAt: now,
            updatedAt: now
        },
        {
            id: 'task-3',
            title: 'Write content for About page',
            description: 'Draft compelling copy for the About page including company history, mission, and team section.',
            status: 'backlog',
            priority: 3,
            dueDate: null,
            labelColor: '#D97706',
            category: 'personal',
            assignees: ['member-1', 'member-2'],
            subtasks: [],
            attachments: [],
            comments: [],
            projectId: 'project-1',
            createdAt: now,
            updatedAt: now
        },
        {
            id: 'task-4',
            title: 'Set up CI/CD pipeline',
            description: 'Configure automated deployment pipeline with testing, staging, and production environments.',
            status: 'done',
            priority: 1,
            dueDate: yesterday,
            labelColor: '#16A34A',
            category: 'work',
            assignees: ['member-3'],
            subtasks: [
                { id: 'st-5', title: 'Configure GitHub Actions', completed: true },
                { id: 'st-6', title: 'Set up staging environment', completed: true },
                { id: 'st-7', title: 'Add automated tests', completed: true }
            ],
            attachments: [],
            comments: [],
            projectId: 'project-1',
            createdAt: now,
            updatedAt: now
        },
        {
            id: 'task-5',
            title: 'User testing session',
            description: 'Conduct user testing with 5 participants to gather feedback on the new design.',
            status: 'in-progress',
            priority: 2,
            dueDate: tomorrow,
            labelColor: '#7C3AED',
            category: 'personal',
            assignees: ['member-4'],
            subtasks: [
                { id: 'st-8', title: 'Recruit participants', completed: true },
                { id: 'st-9', title: 'Prepare test scenarios', completed: true },
                { id: 'st-10', title: 'Conduct sessions', completed: false },
                { id: 'st-11', title: 'Compile feedback report', completed: false }
            ],
            attachments: [],
            comments: [],
            projectId: 'project-1',
            createdAt: now,
            updatedAt: now
        },
        {
            id: 'task-6',
            title: 'App store listing optimisation',
            description: 'Optimise app store listing with keywords, screenshots, and compelling description.',
            status: 'backlog',
            priority: 2,
            dueDate: nextWeek,
            labelColor: '#DB2777',
            category: 'work',
            assignees: ['member-1'],
            subtasks: [],
            attachments: [],
            comments: [],
            projectId: 'project-2',
            createdAt: now,
            updatedAt: now
        },
        {
            id: 'task-7',
            title: 'Beta testing feedback review',
            description: 'Review and categorise all feedback from beta testing phase.',
            status: 'done',
            priority: 1,
            dueDate: yesterday,
            labelColor: '#059669',
            category: 'health',
            assignees: ['member-1', 'member-4'],
            subtasks: [],
            attachments: [],
            comments: [],
            projectId: 'project-2',
            createdAt: now,
            updatedAt: now
        }
    ];

    state.currentWorkspaceId = 'workspace-1';
    state.currentProjectId = 'project-1';
}

/**
 * Gets the current state or a specific path
 * @param {string} [path] - Optional dot-notation path (e.g., 'ui.theme')
 * @returns {*} State value
 */
export function getState(path) {
    if (!path) return deepClone(state);
    
    const keys = path.split('.');
    let value = state;
    for (const key of keys) {
        if (value === undefined) return undefined;
        value = value[key];
    }
    return deepClone(value);
}

/**
 * Updates the state at a specific path
 * @param {string} path - Dot-notation path
 * @param {*} value - New value
 * @param {boolean} [persist=true] - Whether to persist to storage
 */
export async function setState(path, value, persist = true) {
    const keys = path.split('.');
    let current = state;
    
    for (let i = 0; i < keys.length - 1; i++) {
        if (!(keys[i] in current)) {
            current[keys[i]] = {};
        }
        current = current[keys[i]];
    }
    
    const lastKey = keys[keys.length - 1];
    const oldValue = current[lastKey];
    current[lastKey] = value;
    
    notify(path, value, oldValue);
    
    if (persist) {
        await persistState();
    }
}

/**
 * Persists the current state to storage
 */
async function persistState() {
    await storage.set('appState', state);

    // Background Sync (queues when offline; dissertation artefact parity)
    if (typeof navigator !== 'undefined' && !navigator.onLine && 'serviceWorker' in navigator) {
        try {
            const reg = await navigator.serviceWorker.ready;
            if (reg.sync && reg.sync.register) {
                await reg.sync.register('sync-tasks');
            }
        } catch (_) {
            /* noop — API may be missing (e.g. Safari) */
        }
    }
}

/**
 * Subscribes to state changes
 * @param {string|string[]} paths - Path(s) to watch
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function subscribe(paths, callback) {
    const pathArray = Array.isArray(paths) ? paths : [paths];
    
    pathArray.forEach(path => {
        if (!subscribers.has(path)) {
            subscribers.set(path, new Set());
        }
        subscribers.get(path).add(callback);
    });
    
    // Return unsubscribe function
    return () => {
        pathArray.forEach(path => {
            const subs = subscribers.get(path);
            if (subs) {
                subs.delete(callback);
            }
        });
    };
}

/**
 * Notifies subscribers of state changes
 * @param {string} path - Changed path
 * @param {*} newValue - New value
 * @param {*} [oldValue] - Previous value
 */
function notify(path, newValue, oldValue) {
    // Notify exact path subscribers
    const exactSubs = subscribers.get(path);
    if (exactSubs) {
        exactSubs.forEach(cb => cb(newValue, oldValue, path));
    }
    
    // Notify parent path subscribers
    const parts = path.split('.');
    for (let i = parts.length - 1; i > 0; i--) {
        const parentPath = parts.slice(0, i).join('.');
        const parentSubs = subscribers.get(parentPath);
        if (parentSubs) {
            parentSubs.forEach(cb => cb(getState(parentPath), null, path));
        }
    }
    
    // Notify wildcard subscribers
    const wildcardSubs = subscribers.get('*');
    if (wildcardSubs) {
        wildcardSubs.forEach(cb => cb(state, null, path));
    }
}

// ============================================================================
// TASK OPERATIONS
// ============================================================================

/**
 * Gets all tasks, optionally filtered
 * @param {Object} [filters] - Filter criteria
 * @returns {Task[]} Filtered tasks
 */
export function getTasks(filters = {}) {
    let tasks = [...state.tasks];
    
    // Filter by project
    if (state.currentProjectId) {
        tasks = tasks.filter(t => t.projectId === state.currentProjectId);
    }
    
    // Apply filters
    const { status, priority, assignee, category, search } = { ...state.filters, ...filters };
    
    if (status) {
        tasks = tasks.filter(t => t.status === status);
    }
    
    if (priority) {
        tasks = tasks.filter(t => t.priority === priority);
    }
    
    if (assignee) {
        tasks = tasks.filter(t => {
            const ids = Array.isArray(t.assignees) ? t.assignees : [];
            return ids.includes(assignee);
        });
    }

    if (category) {
        tasks = tasks.filter(t => normalizeCategoryId(t.category) === category);
    }
    
    if (search) {
        const query = search.toLowerCase();
        tasks = tasks.filter(t =>
            (t.title || '').toLowerCase().includes(query) ||
            (t.description || '').toLowerCase().includes(query) ||
            normalizeCategoryId(t.category).includes(query) ||
            getCategoryLabel(t.category).toLowerCase().includes(query)
        );
    }
    
    // Sort
    const { sortBy, sortDirection } = state.filters;
    tasks.sort((a, b) => {
        let valA = a[sortBy];
        let valB = b[sortBy];
        
        if (sortBy === 'dueDate') {
            valA = valA ? new Date(valA).getTime() : Infinity;
            valB = valB ? new Date(valB).getTime() : Infinity;
        }
        
        if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
        if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
        return 0;
    });
    
    return tasks;
}

/**
 * Gets a single task by ID
 * @param {string} taskId - Task ID
 * @returns {Task|undefined} Task object
 */
export function getTask(taskId) {
    return state.tasks.find(t => t.id === taskId);
}

/**
 * Creates a new task
 * @param {Partial<Task>} taskData - Task data
 * @returns {Task} Created task
 */
export async function createTask(taskData) {
    const now = new Date().toISOString();
    const task = {
        id: generateId(),
        title: '',
        description: '',
        status: 'backlog',
        priority: 2,
        dueDate: null,
        labelColor: '#4F46E5',
        assignees: [],
        subtasks: [],
        attachments: [],
        comments: [],
        category: 'general',
        projectId: state.currentProjectId,
        createdAt: now,
        updatedAt: now,
        ...taskData
    };

    task.category = normalizeCategoryId(task.category);

    state.tasks.push(task);
    notify('tasks', state.tasks);
    await persistState();
    
    return task;
}

/**
 * Updates an existing task
 * @param {string} taskId - Task ID
 * @param {Partial<Task>} updates - Fields to update
 * @returns {Task|null} Updated task
 */
export async function updateTask(taskId, updates) {
    const index = state.tasks.findIndex(t => t.id === taskId);
    if (index === -1) return null;

    const prevStatus = state.tasks[index].status;
    
    state.tasks[index] = {
        ...state.tasks[index],
        ...updates,
        updatedAt: new Date().toISOString()
    };
    state.tasks[index].category = normalizeCategoryId(state.tasks[index].category);

    if (updates.status === 'done' && prevStatus !== 'done') {
        try {
            const { recordTaskCompletionForInstall } = await import('./engagement.js');
            recordTaskCompletionForInstall();
        } catch (_) {
            /* offline bundling edge cases */
        }
    }
    
    notify('tasks', state.tasks);
    await persistState();
    
    return state.tasks[index];
}

/**
 * Deletes a task
 * @param {string} taskId - Task ID
 * @returns {boolean} Success status
 */
export async function deleteTask(taskId) {
    const index = state.tasks.findIndex(t => t.id === taskId);
    if (index === -1) return false;
    
    state.tasks.splice(index, 1);
    notify('tasks', state.tasks);
    await persistState();
    
    return true;
}

/**
 * Moves a task to a different status column
 * @param {string} taskId - Task ID
 * @param {string} newStatus - New status value
 * @returns {Task|null} Updated task
 */
export async function moveTask(taskId, newStatus) {
    return updateTask(taskId, { status: newStatus });
}

/**
 * Bulk updates multiple tasks
 * @param {string[]} taskIds - Array of task IDs
 * @param {Partial<Task>} updates - Fields to update
 * @returns {Task[]} Updated tasks
 */
export async function bulkUpdateTasks(taskIds, updates) {
    const updatedTasks = [];
    const now = new Date().toISOString();
    
    taskIds.forEach(id => {
        const index = state.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            state.tasks[index] = {
                ...state.tasks[index],
                ...updates,
                updatedAt: now
            };
            state.tasks[index].category = normalizeCategoryId(state.tasks[index].category);
            updatedTasks.push(state.tasks[index]);
        }
    });
    
    notify('tasks', state.tasks);
    await persistState();
    
    return updatedTasks;
}

/**
 * Bulk deletes multiple tasks
 * @param {string[]} taskIds - Array of task IDs
 * @returns {number} Number of deleted tasks
 */
export async function bulkDeleteTasks(taskIds) {
    const initialLength = state.tasks.length;
    state.tasks = state.tasks.filter(t => !taskIds.includes(t.id));
    const deletedCount = initialLength - state.tasks.length;
    
    if (deletedCount > 0) {
        notify('tasks', state.tasks);
        await persistState();
    }
    
    return deletedCount;
}

// ============================================================================
// PROJECT & WORKSPACE OPERATIONS
// ============================================================================

/**
 * Gets the current project
 * @returns {Project|null} Current project
 */
export function getCurrentProject() {
    return state.projects.find(p => p.id === state.currentProjectId) || null;
}

/**
 * Gets all projects in current workspace
 * @returns {Project[]} Projects
 */
export function getProjects() {
    if (!state.currentWorkspaceId) return [];
    return state.projects.filter(p => p.workspaceId === state.currentWorkspaceId);
}

/**
 * Switches to a different project
 * @param {string} projectId - Project ID
 */
export async function switchProject(projectId) {
    await setState('currentProjectId', projectId);
    await setState('ui.selectedTasks', []);
}

// ============================================================================
// MEMBER OPERATIONS
// ============================================================================

/**
 * Gets all members
 * @returns {Member[]} Members
 */
export function getMembers() {
    return [...state.members];
}

/**
 * Gets a member by ID
 * @param {string} memberId - Member ID
 * @returns {Member|undefined} Member object
 */
export function getMember(memberId) {
    return state.members.find(m => m.id === memberId);
}

/**
 * Adds a new member (mock invite)
 * @param {Object} memberData - Member data
 * @returns {Member} Created member
 */
export async function addMember(memberData) {
    const member = {
        id: generateId(),
        name: memberData.name || memberData.email.split('@')[0],
        email: memberData.email,
        avatar: null,
        role: memberData.role || 'viewer',
        ...memberData
    };
    
    state.members.push(member);
    notify('members', state.members);
    await persistState();
    
    return member;
}

// ============================================================================
// FILTER OPERATIONS
// ============================================================================

/**
 * Updates filter settings
 * @param {Object} filters - Filter settings to update
 */
export async function setFilters(filters) {
    await setState('filters', { ...state.filters, ...filters });
}

/**
 * Clears all filters
 */
export async function clearFilters() {
    await setState('filters', {
        status: null,
        priority: null,
        assignee: null,
        category: null,
        search: '',
        sortBy: 'createdAt',
        sortDirection: 'desc'
    });
}

// ============================================================================
// UI STATE OPERATIONS
// ============================================================================

/**
 * Sets the UI theme
 * @param {'light'|'dark'|'system'} theme - Theme value
 */
export async function setTheme(theme) {
    await setState('ui.theme', theme);
    applyTheme(theme);
}

/**
 * Applies the theme to the document
 * @param {'light'|'dark'|'system'} theme - Theme value
 */
function applyTheme(theme) {
    const root = document.documentElement;
    
    if (theme === 'system') {
        root.removeAttribute('data-theme');
    } else {
        root.setAttribute('data-theme', theme);
    }
}

/**
 * Sets the current view mode
 * @param {'kanban'|'list'|'calendar'} view - View mode
 */
export async function setView(view) {
    await setState('ui.view', view);
}

/**
 * Toggles task selection
 * @param {string} taskId - Task ID
 * @param {boolean} [ctrlKey=false] - Whether Ctrl/Cmd is pressed
 */
export async function toggleTaskSelection(taskId, ctrlKey = false) {
    let selected = [...state.ui.selectedTasks];
    
    if (ctrlKey) {
        // Multi-select mode
        const index = selected.indexOf(taskId);
        if (index === -1) {
            selected.push(taskId);
        } else {
            selected.splice(index, 1);
        }
    } else {
        // Single select mode
        selected = selected.includes(taskId) && selected.length === 1 ? [] : [taskId];
    }
    
    await setState('ui.selectedTasks', selected);
}

/**
 * Clears all task selections
 */
export async function clearTaskSelection() {
    await setState('ui.selectedTasks', []);
}

/**
 * Exports the current state for debugging or backup
 * @returns {string} JSON string of state
 */
export function exportState() {
    return JSON.stringify(state, null, 2);
}

/**
 * Imports state from JSON (for restore/debugging)
 * @param {string} jsonString - JSON state string
 */
export async function importState(jsonString) {
    try {
        const imported = JSON.parse(jsonString);
        state = {
            ...defaultState,
            ...imported,
            filters: { ...defaultState.filters, ...(imported.filters && typeof imported.filters === 'object' ? imported.filters : {}) },
            ui: { ...defaultState.ui, ...(imported.ui && typeof imported.ui === 'object' ? imported.ui : {}) },
            settings: { ...defaultState.settings, ...(imported.settings && typeof imported.settings === 'object' ? imported.settings : {}) },
            tasks: normalizeStoredTasks(imported.tasks ?? defaultState.tasks)
        };
        notify('*', state);
        await persistState();
        return true;
    } catch (e) {
        console.error('Failed to import state:', e);
        return false;
    }
}

// Initialize theme on load
if (typeof window !== 'undefined') {
    const savedTheme = getState('ui.theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    }
}
