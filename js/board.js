/**
 * ============================================================================
 * BOARD.JS - Kanban Board Logic
 * ============================================================================
 * Drag and drop functionality and board rendering.
 * @module board
 */

import { 
    getTasks, 
    getTask, 
    moveTask, 
    updateTask, 
    createTask, 
    deleteTask,
    subscribe, 
    getState, 
    setState,
    toggleTaskSelection,
    bulkUpdateTasks,
    bulkDeleteTasks,
    getMember,
    TASK_CATEGORIES,
    normalizeCategoryId,
    getCategoryLabel
} from './state.js';
import { 
    escapeHtml, 
    formatDate, 
    formatRelativeTime, 
    getInitials, 
    isPast,
    isToday,
    truncate
} from './utils.js';
import { Toast, Modal, createAvatarGroup } from './ui.js';

/**
 * Board column definitions
 */
export const COLUMNS = [
    { id: 'backlog', label: 'Backlog', icon: 'layers' },
    { id: 'in-progress', label: 'In Progress', icon: 'clock' },
    { id: 'done', label: 'Done', icon: 'check-circle' }
];

/**
 * Priority labels
 */
export const PRIORITIES = {
    1: { label: 'High', color: 'danger' },
    2: { label: 'Medium', color: 'warning' },
    3: { label: 'Low', color: 'default' }
};

/**
 * Drag state
 */
let dragState = {
    dragging: null,
    dropTarget: null,
    placeholder: null
};

/** { y: number, m: 0-11 } — month shown in calendar view */
let calendarViewCursor = null;

function getCalendarViewCursor() {
    if (!calendarViewCursor) {
        const d = new Date();
        calendarViewCursor = { y: d.getFullYear(), m: d.getMonth() };
    }
    return calendarViewCursor;
}

function adjustCalendarView(step) {
    const cur = getCalendarViewCursor();
    const d = new Date(cur.y, cur.m, 1);
    if (step === 'prev') d.setMonth(d.getMonth() - 1);
    else if (step === 'next') d.setMonth(d.getMonth() + 1);
    else {
        const t = new Date();
        d.setFullYear(t.getFullYear());
        d.setMonth(t.getMonth());
    }
    calendarViewCursor = { y: d.getFullYear(), m: d.getMonth() };
}

function localDayParts(ts) {
    const d = new Date(ts);
    return { y: d.getFullYear(), m: d.getMonth(), day: d.getDate() };
}

function tasksDueOnDay(tasks, y, m, day) {
    return tasks.filter(t => {
        if (!t.dueDate) return false;
        const { y: ty, m: tm, day: td } = localDayParts(t.dueDate);
        return ty === y && tm === m && td === day;
    });
}

function weekdaysHeader() {
    const w = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return `<div class="board-calendar__dow">${w.map(d => `<div>${d}</div>`).join('')}</div>`;
}

/**
 * Initializes the Kanban board
 * @param {HTMLElement} container - Board container element
 */
export function initBoard(container) {
    if (!container) return;

    // Render initial board
    renderBoard(container);

    // Subscribe to task changes
    subscribe('tasks', () => renderBoard(container));
    subscribe('ui.selectedTasks', () => updateSelectedTasks(container));
    subscribe('filters', () => renderBoard(container));
    subscribe('ui.view', () => renderBoard(container));

    attachBoardListeners(container);
    // Initialize drag and drop
    initDragAndDrop(container);

    console.log('[Board] Initialized');
}

/**
 * Renders the active board layout (Kanban, list, or calendar — proposal parity).
 * @param {HTMLElement} container - Board container
 */
export function renderBoard(container) {
    const view = getState('ui.view') || 'kanban';
    if (view === 'list') {
        renderListBoard(container);
    } else if (view === 'calendar') {
        renderCalendarBoard(container);
    } else {
        renderKanbanBoard(container);
    }
}

function renderKanbanBoard(container) {
    const tasks = getTasks();
    const selectedTasks = getState('ui.selectedTasks') || [];

    const tasksByStatus = {
        'backlog': [],
        'in-progress': [],
        'done': []
    };

    tasks.forEach(task => {
        if (tasksByStatus[task.status]) {
            tasksByStatus[task.status].push(task);
        }
    });

    container.innerHTML = `
        <div class="board">
            ${COLUMNS.map(column => `
                <div class="board__column" data-column="${column.id}">
                    <div class="board__column-header">
                        <div class="flex items-center gap-2">
                            <svg class="icon icon--sm text-tertiary" aria-hidden="true">
                                <use href="#icon-${column.icon}"></use>
                            </svg>
                            <h3 class="board__column-title">${column.label}</h3>
                            <span class="badge badge--default">${tasksByStatus[column.id].length}</span>
                        </div>
                        <button 
                            class="btn btn--ghost btn--icon btn--sm" 
                            data-add-task="${column.id}"
                            aria-label="Add task to ${column.label}"
                        >
                            <svg class="icon icon--sm" aria-hidden="true">
                                <use href="#icon-plus"></use>
                            </svg>
                        </button>
                    </div>
                    <div class="board__column-content" data-dropzone="${column.id}">
                        ${tasksByStatus[column.id].length > 0 
                            ? tasksByStatus[column.id].map(task => 
                                renderTaskCard(task, selectedTasks.includes(task.id))
                              ).join('')
                            : renderEmptyColumn(column.id)
                        }
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function renderListBoard(container) {
    const tasks = getTasks();
    const selectedTasks = getState('ui.selectedTasks') || [];

    container.innerHTML = `
        <div class="board-list-view" role="list" aria-label="Task list">
            ${tasks.length === 0 ? `
                <div class="board-list-empty text-center py-16 text-secondary text-sm">
                    No tasks match the current filters.
                </div>
            ` : tasks.map(task => `
                <div class="board-list-view__row" role="listitem">
                    ${renderTaskCard(task, selectedTasks.includes(task.id), { draggable: false })}
                </div>
            `).join('')}
        </div>
    `;
}

function renderCalendarBoard(container) {
    const tasks = getTasks();
    const selectedTasks = getState('ui.selectedTasks') || [];
    const { y, m } = getCalendarViewCursor();
    const monthLabel = new Date(y, m, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' });

    const firstDow = (new Date(y, m, 1).getDay() + 6) % 7; // Monday = 0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = new Date();

    let cells = '';
    for (let i = 0; i < firstDow; i++) {
        cells += '<div class="board-calendar__cell board-calendar__cell--empty"></div>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const dayTasks = tasksDueOnDay(tasks, y, m, day);
        const isToday = today.getDate() === day && today.getMonth() === m && today.getFullYear() === y;
        cells += `
            <div class="board-calendar__cell ${isToday ? 'board-calendar__cell--today' : ''}" role="gridcell"
                 aria-label="${monthLabel} ${day}, ${dayTasks.length} tasks due">
                <div class="board-calendar__daynum">${day}</div>
                <div class="board-calendar__tasks">
                    ${dayTasks.slice(0, 4).map(t => `
                        <button type="button" class="board-calendar__pill" data-cal-task="${t.id}"
                            title="${escapeHtml(t.title)}">
                            ${escapeHtml(truncate(t.title, 28))}
                        </button>
                    `).join('')}
                    ${dayTasks.length > 4 ? `<span class="text-xs text-tertiary px-1">+${dayTasks.length - 4}</span>` : ''}
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="board-calendar-wrap">
            <div class="board-calendar__toolbar flex items-center justify-between gap-4 mb-4 flex-wrap">
                <h3 class="text-lg font-semibold m-0">${escapeHtml(monthLabel)}</h3>
                <div class="flex gap-2 flex-wrap">
                    <button type="button" class="btn btn--secondary btn--sm" data-cal-nav="prev" aria-label="Previous month">
                        <svg class="icon icon--sm" aria-hidden="true"><use href="#icon-chevron-left"></use></svg>
                    </button>
                    <button type="button" class="btn btn--secondary btn--sm" data-cal-nav="today">Today</button>
                    <button type="button" class="btn btn--secondary btn--sm" data-cal-nav="next" aria-label="Next month">
                        <svg class="icon icon--sm" aria-hidden="true"><use href="#icon-chevron-right"></use></svg>
                    </button>
                </div>
            </div>
            <div class="board-calendar" role="grid" aria-label="Tasks by due date">
                ${weekdaysHeader()}
                <div class="board-calendar__grid">
                    ${cells}
                </div>
            </div>
            <p class="text-xs text-tertiary mt-3">Tasks without a due date do not appear on the calendar.</p>
        </div>
    `;
}

/**
 * Renders a task card
 * @param {Object} task - Task object
 * @param {boolean} isSelected - Whether task is selected
 * @returns {string} HTML string
 */
export function renderTaskCard(task, isSelected = false, opts = {}) {
    const draggable = opts.draggable !== false;
    const priority = PRIORITIES[task.priority] || PRIORITIES[2];
    const isOverdue = task.dueDate && isPast(task.dueDate) && task.status !== 'done';
    const isDueToday = task.dueDate && isToday(task.dueDate);
    const completedSubtasks = task.subtasks?.filter(s => s.completed).length || 0;
    const totalSubtasks = task.subtasks?.length || 0;
    const progress = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

    return `
        <article 
            class="task-card ${isSelected ? 'is-selected' : ''} ${isOverdue ? 'is-overdue' : ''}"
            data-task-id="${task.id}"
            draggable="${draggable ? 'true' : 'false'}"
            tabindex="0"
            role="article"
            aria-label="Task: ${escapeHtml(task.title)}"
        >
            <div class="task-card__header">
                <label class="checkbox task-card__checkbox" data-stop-propagation>
                    <input 
                        type="checkbox" 
                        ${task.status === 'done' ? 'checked' : ''} 
                        data-complete-task="${task.id}"
                        aria-label="Mark as ${task.status === 'done' ? 'incomplete' : 'complete'}"
                    >
                </label>
                <div class="task-card__label" style="background-color: ${task.labelColor}20; color: ${task.labelColor};">
                    <span class="task-card__label-dot" style="background-color: ${task.labelColor};"></span>
                </div>
                <button 
                    class="btn btn--ghost btn--icon btn--sm task-card__menu"
                    data-task-menu="${task.id}"
                    aria-label="Task options"
                    aria-haspopup="true"
                >
                    <svg class="icon icon--sm" aria-hidden="true">
                        <use href="#icon-more"></use>
                    </svg>
                </button>
            </div>
            
            <h4 class="task-card__title ${task.status === 'done' ? 'is-completed' : ''}">
                ${escapeHtml(task.title)}
            </h4>
            
            ${task.description ? `
                <p class="task-card__description">${escapeHtml(truncate(task.description, 80))}</p>
            ` : ''}
            
            ${totalSubtasks > 0 ? `
                <div class="task-card__subtasks">
                    <div class="progress progress--sm">
                        <div class="progress__bar ${progress === 100 ? 'progress__bar--success' : ''}" style="width: ${progress}%"></div>
                    </div>
                    <span class="text-xs text-tertiary">${completedSubtasks}/${totalSubtasks} subtasks</span>
                </div>
            ` : ''}
            
            <div class="task-card__footer">
                <div class="task-card__meta">
                    <span class="task-card__category text-xs text-tertiary" title="Category">
                        ${escapeHtml(getCategoryLabel(task.category))}
                    </span>
                    ${task.dueDate ? `
                        <span class="task-card__due ${isOverdue ? 'is-overdue' : ''} ${isDueToday ? 'is-today' : ''}">
                            <svg class="icon icon--sm" aria-hidden="true">
                                <use href="#icon-calendar"></use>
                            </svg>
                            ${formatDate(task.dueDate)}
                        </span>
                    ` : ''}
                    <span class="priority-badge priority-badge--${priority.color}">
                        <svg class="icon icon--sm" aria-hidden="true">
                            <use href="#icon-flag"></use>
                        </svg>
                        ${priority.label}
                    </span>
                </div>
                ${task.assignees?.length > 0 ? createAvatarGroup(task.assignees) : ''}
            </div>
            
            ${task.comments?.length > 0 || task.attachments?.length > 0 ? `
                <div class="task-card__indicators">
                    ${task.comments?.length > 0 ? `
                        <span class="task-card__indicator" title="${task.comments.length} comments">
                            <svg class="icon icon--sm" aria-hidden="true">
                                <use href="#icon-message"></use>
                            </svg>
                            ${task.comments.length}
                        </span>
                    ` : ''}
                    ${task.attachments?.length > 0 ? `
                        <span class="task-card__indicator" title="${task.attachments.length} attachments">
                            <svg class="icon icon--sm" aria-hidden="true">
                                <use href="#icon-attachment"></use>
                            </svg>
                            ${task.attachments.length}
                        </span>
                    ` : ''}
                </div>
            ` : ''}
        </article>
    `;
}

/**
 * Renders empty column state
 * @param {string} columnId - Column ID
 * @returns {string} HTML string
 */
function renderEmptyColumn(columnId) {
    return `
        <div class="board__empty">
            <svg class="icon icon--xl text-disabled" aria-hidden="true">
                <use href="#icon-layers"></use>
            </svg>
            <p class="text-sm text-tertiary mt-2">No tasks here yet</p>
            <button 
                class="btn btn--secondary btn--sm mt-3" 
                data-add-task="${columnId}"
            >
                <svg class="icon icon--sm" aria-hidden="true">
                    <use href="#icon-plus"></use>
                </svg>
                Add task
            </button>
        </div>
    `;
}

/**
 * Attaches event listeners to the board
 * @param {HTMLElement} container - Board container
 */
function attachBoardListeners(container) {
    // Task card click
    container.addEventListener('click', async (e) => {
        const calNav = e.target.closest('[data-cal-nav]');
        if (calNav) {
            e.preventDefault();
            adjustCalendarView(calNav.dataset.calNav);
            renderBoard(container);
            return;
        }

        const calTask = e.target.closest('[data-cal-task]');
        if (calTask) {
            e.preventDefault();
            openTaskDetailModal(calTask.getAttribute('data-cal-task'));
            return;
        }

        // Prevent propagation items
        if (e.target.closest('[data-stop-propagation]')) {
            return;
        }

        const taskCard = e.target.closest('.task-card');
        const addTaskBtn = e.target.closest('[data-add-task]');
        const completeCheckbox = e.target.closest('[data-complete-task]');
        const taskMenuBtn = e.target.closest('[data-task-menu]');

        if (completeCheckbox) {
            e.stopPropagation();
            const taskId = completeCheckbox.dataset.completeTask;
            const task = getTask(taskId);
            const newStatus = task.status === 'done' ? 'backlog' : 'done';
            await moveTask(taskId, newStatus);
            Toast.success('Task updated', newStatus === 'done' ? 'Task completed!' : 'Task moved to backlog');
            return;
        }

        if (taskMenuBtn) {
            e.stopPropagation();
            showTaskMenu(taskMenuBtn, taskMenuBtn.dataset.taskMenu);
            return;
        }

        if (addTaskBtn) {
            const status = addTaskBtn.dataset.addTask;
            openQuickAddModal(status);
            return;
        }

        if (taskCard && !e.target.closest('button') && !e.target.closest('input')) {
            const taskId = taskCard.dataset.taskId;
            
            // Ctrl/Cmd + click for multi-select
            if (e.ctrlKey || e.metaKey) {
                await toggleTaskSelection(taskId, true);
            } else {
                openTaskDetailModal(taskId);
            }
        }
    });

    // Keyboard navigation
    container.addEventListener('keydown', (e) => {
        const taskCard = e.target.closest('.task-card');
        if (!taskCard) return;

        const taskId = taskCard.dataset.taskId;

        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault();
                openTaskDetailModal(taskId);
                break;
            case 'Delete':
            case 'Backspace':
                e.preventDefault();
                confirmDeleteTask(taskId);
                break;
            case 'ArrowDown':
            case 'ArrowUp':
                e.preventDefault();
                navigateCards(taskCard, e.key === 'ArrowDown' ? 1 : -1);
                break;
        }
    });
}

/**
 * Navigates between task cards
 * @param {HTMLElement} currentCard - Current card
 * @param {number} direction - 1 for down, -1 for up
 */
function navigateCards(currentCard, direction) {
    const cards = Array.from(document.querySelectorAll('.task-card'));
    const currentIndex = cards.indexOf(currentCard);
    const nextIndex = currentIndex + direction;

    if (nextIndex >= 0 && nextIndex < cards.length) {
        cards[nextIndex].focus();
    }
}

/**
 * Updates selected task styling
 * @param {HTMLElement} container - Board container
 */
function updateSelectedTasks(container) {
    const selectedIds = getState('ui.selectedTasks') || [];
    
    container.querySelectorAll('.task-card').forEach(card => {
        const isSelected = selectedIds.includes(card.dataset.taskId);
        card.classList.toggle('is-selected', isSelected);
    });
}

// ============================================================================
// DRAG AND DROP
// ============================================================================

/**
 * Initializes drag and drop functionality
 * @param {HTMLElement} container - Board container
 */
function initDragAndDrop(container) {
    // Drag start
    container.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.task-card');
        if (!card) return;

        dragState.dragging = card;
        card.classList.add('is-dragging');

        // Set drag data
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', card.dataset.taskId);

        // Create custom drag image
        const dragImage = card.cloneNode(true);
        dragImage.style.width = `${card.offsetWidth}px`;
        dragImage.style.opacity = '0.8';
        dragImage.style.position = 'absolute';
        dragImage.style.top = '-9999px';
        document.body.appendChild(dragImage);
        e.dataTransfer.setDragImage(dragImage, 20, 20);
        setTimeout(() => dragImage.remove(), 0);
    });

    // Drag over
    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';

        const dropzone = e.target.closest('[data-dropzone]');
        if (!dropzone) return;

        // Highlight dropzone
        document.querySelectorAll('[data-dropzone]').forEach(zone => {
            zone.classList.remove('is-drop-target');
        });
        dropzone.classList.add('is-drop-target');
        dragState.dropTarget = dropzone;

        // Position placeholder
        const afterCard = getCardAfterDrag(dropzone, e.clientY);
        if (afterCard) {
            afterCard.parentNode.insertBefore(dragState.dragging, afterCard);
        } else {
            dropzone.appendChild(dragState.dragging);
        }
    });

    // Drag leave
    container.addEventListener('dragleave', (e) => {
        const dropzone = e.target.closest('[data-dropzone]');
        if (dropzone && !dropzone.contains(e.relatedTarget)) {
            dropzone.classList.remove('is-drop-target');
        }
    });

    // Drop
    container.addEventListener('drop', async (e) => {
        e.preventDefault();

        const dropzone = e.target.closest('[data-dropzone]');
        if (!dropzone || !dragState.dragging) return;

        const taskId = dragState.dragging.dataset.taskId;
        const newStatus = dropzone.dataset.dropzone;

        // Update task status
        await moveTask(taskId, newStatus);

        // Clean up
        dropzone.classList.remove('is-drop-target');
        Toast.success('Task moved', `Moved to ${COLUMNS.find(c => c.id === newStatus)?.label}`);
    });

    // Drag end
    container.addEventListener('dragend', () => {
        if (dragState.dragging) {
            dragState.dragging.classList.remove('is-dragging');
        }

        document.querySelectorAll('[data-dropzone]').forEach(zone => {
            zone.classList.remove('is-drop-target');
        });

        dragState = { dragging: null, dropTarget: null, placeholder: null };
    });
}

/**
 * Gets the card to insert after based on mouse position
 * @param {HTMLElement} container - Container element
 * @param {number} y - Mouse Y position
 * @returns {HTMLElement|null} Card to insert after
 */
function getCardAfterDrag(container, y) {
    const cards = Array.from(container.querySelectorAll('.task-card:not(.is-dragging)'));

    return cards.reduce((closest, card) => {
        const box = card.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > (closest.offset || -Infinity)) {
            return { offset, element: card };
        }
        return closest;
    }, {}).element || null;
}

// ============================================================================
// TASK MODALS
// ============================================================================

/**
 * Opens the quick add task modal
 * @param {string} status - Initial status
 */
export function openQuickAddModal(status = 'backlog') {
    const content = `
        <form id="quick-add-form" class="form">
            <div class="form-group">
                <label class="label label--required" for="task-title">Title</label>
                <input 
                    type="text" 
                    id="task-title" 
                    class="input" 
                    placeholder="What needs to be done?"
                    required
                    autofocus
                >
            </div>
            <div class="form-group">
                <label class="label" for="task-description">Description</label>
                <textarea 
                    id="task-description" 
                    class="input" 
                    rows="3"
                    placeholder="Add details..."
                ></textarea>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div class="form-group">
                    <label class="label" for="task-category">Category</label>
                    <select id="task-category" class="input select">
                        ${TASK_CATEGORIES.map(c =>
        `<option value="${c.id}">${escapeHtml(c.label)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="label" for="task-priority">Priority</label>
                    <select id="task-priority" class="input select">
                        <option value="3">Low</option>
                        <option value="2" selected>Medium</option>
                        <option value="1">High</option>
                    </select>
                </div>
            </div>
            <div class="form-group">
                <label class="label" for="task-due">Due Date</label>
                <input type="date" id="task-due" class="input">
            </div>
            <div class="form-group">
                <label class="label">Label Color</label>
                <div class="color-swatches" role="radiogroup" aria-label="Label color">
                    ${renderColorSwatches()}
                </div>
            </div>
        </form>
    `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
        <button type="button" class="btn btn--secondary" data-dismiss>Cancel</button>
        <button type="submit" form="quick-add-form" class="btn btn--primary">
            <svg class="icon icon--sm" aria-hidden="true">
                <use href="#icon-plus"></use>
            </svg>
            Add Task
        </button>
    `;

    const modal = Modal.open({
        title: 'New Task',
        content,
        footer,
        size: 'lg'
    });

    // Handle form submission
    const form = modal.querySelector('#quick-add-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const title = form.querySelector('#task-title').value.trim();
        const description = form.querySelector('#task-description').value.trim();
        const priority = parseInt(form.querySelector('#task-priority').value);
        const category = normalizeCategoryId(form.querySelector('#task-category')?.value);
        const dueDate = form.querySelector('#task-due').value || null;
        const labelColor = form.querySelector('.color-swatch.is-selected')?.dataset.color || '#4F46E5';

        if (!title) {
            Toast.error('Error', 'Title is required');
            return;
        }

        await createTask({
            title,
            description,
            status,
            priority,
            category,
            dueDate,
            labelColor
        });

        Modal.close(modal);
        Toast.success('Task created', `"${truncate(title, 30)}" added to ${COLUMNS.find(c => c.id === status)?.label}`);
    });

    // Handle cancel
    footer.querySelector('[data-dismiss]').addEventListener('click', () => {
        Modal.close(modal);
    });

    // Handle color swatch selection
    modal.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            modal.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('is-selected'));
            swatch.classList.add('is-selected');
        });
    });
}

/**
 * Opens the task detail modal
 * @param {string} taskId - Task ID
 */
export function openTaskDetailModal(taskId) {
    const task = getTask(taskId);
    if (!task) return;

    const priority = PRIORITIES[task.priority] || PRIORITIES[2];
    const column = COLUMNS.find(c => c.id === task.status);

    const content = `
        <div class="task-detail">
            <div class="task-detail__main">
                <div class="task-detail__header">
                    <div class="status-chip status-chip--${task.status}">
                        <svg class="icon icon--sm" aria-hidden="true">
                            <use href="#icon-${column?.icon}"></use>
                        </svg>
                        ${column?.label}
                    </div>
                    <div class="priority-badge priority-badge--${priority.color}">
                        <svg class="icon icon--sm" aria-hidden="true">
                            <use href="#icon-flag"></use>
                        </svg>
                        ${priority.label}
                    </div>
                </div>
                
                <h2 class="task-detail__title" contenteditable="true" data-field="title">${escapeHtml(task.title)}</h2>
                
                <div class="task-detail__description">
                    <h4 class="text-sm font-semibold mb-2">Description</h4>
                    <div 
                        class="task-detail__description-content" 
                        contenteditable="true" 
                        data-field="description"
                        data-placeholder="Add a description..."
                    >${escapeHtml(task.description || '')}</div>
                </div>
                
                ${task.subtasks?.length > 0 ? `
                    <div class="task-detail__subtasks">
                        <h4 class="text-sm font-semibold mb-2">Subtasks</h4>
                        <ul class="subtask-list">
                            ${task.subtasks.map((st, i) => `
                                <li class="subtask-item">
                                    <label class="checkbox">
                                        <input type="checkbox" ${st.completed ? 'checked' : ''} data-subtask="${i}">
                                        <span>${escapeHtml(st.title)}</span>
                                    </label>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${task.comments?.length > 0 ? `
                    <div class="task-detail__comments">
                        <h4 class="text-sm font-semibold mb-2">Comments</h4>
                        <div class="comment-list">
                            ${task.comments.map(comment => {
                                const author = getMember(comment.authorId);
                                return `
                                    <div class="comment">
                                        <div class="avatar avatar--sm">${getInitials(author?.name || 'Unknown')}</div>
                                        <div class="comment__content">
                                            <div class="comment__header">
                                                <span class="font-medium">${escapeHtml(author?.name || 'Unknown')}</span>
                                                <span class="text-xs text-tertiary">${formatRelativeTime(comment.createdAt)}</span>
                                            </div>
                                            <p class="comment__text">${escapeHtml(comment.text)}</p>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}
            </div>
            
            <div class="task-detail__sidebar">
                <div class="task-detail__field">
                    <label class="label">Status</label>
                    <select class="input select" data-field="status">
                        ${COLUMNS.map(col => `
                            <option value="${col.id}" ${task.status === col.id ? 'selected' : ''}>${col.label}</option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="task-detail__field">
                    <label class="label">Priority</label>
                    <select class="input select" data-field="priority">
                        ${Object.entries(PRIORITIES).map(([val, p]) => `
                            <option value="${val}" ${task.priority === parseInt(val) ? 'selected' : ''}>${p.label}</option>
                        `).join('')}
                    </select>
                </div>

                <div class="task-detail__field">
                    <label class="label">Category</label>
                    <select class="input select" data-field="category">
                        ${TASK_CATEGORIES.map(c => `
                            <option value="${c.id}" ${normalizeCategoryId(task.category) === c.id ? 'selected' : ''}>${escapeHtml(c.label)}</option>
                        `).join('')}
                    </select>
                </div>
                
                <div class="task-detail__field">
                    <label class="label">Due Date</label>
                    <input type="date" class="input" data-field="dueDate" value="${task.dueDate?.split('T')[0] || ''}">
                </div>
                
                <div class="task-detail__field">
                    <label class="label">Label Color</label>
                    <div class="color-swatches color-swatches--sm">
                        ${renderColorSwatches(task.labelColor)}
                    </div>
                </div>
                
                <div class="task-detail__field">
                    <label class="label">Assignees</label>
                    ${task.assignees?.length > 0 
                        ? createAvatarGroup(task.assignees, 5)
                        : '<p class="text-sm text-tertiary">No assignees</p>'
                    }
                </div>
                
                <div class="task-detail__meta">
                    <p class="text-xs text-tertiary">Created ${formatRelativeTime(task.createdAt)}</p>
                    <p class="text-xs text-tertiary">Updated ${formatRelativeTime(task.updatedAt)}</p>
                </div>
            </div>
        </div>
    `;

    const footer = document.createElement('div');
    footer.className = 'flex justify-between';
    footer.innerHTML = `
        <button type="button" class="btn btn--danger btn--ghost" data-delete>
            <svg class="icon icon--sm" aria-hidden="true">
                <use href="#icon-trash"></use>
            </svg>
            Delete
        </button>
        <div class="flex gap-3">
            <button type="button" class="btn btn--secondary" data-share>
                <svg class="icon icon--sm" aria-hidden="true">
                    <use href="#icon-external"></use>
                </svg>
                Share
            </button>
            <button type="button" class="btn btn--primary" data-save>
                <svg class="icon icon--sm" aria-hidden="true">
                    <use href="#icon-check"></use>
                </svg>
                Save Changes
            </button>
        </div>
    `;

    const modal = Modal.open({
        title: 'Task Details',
        content,
        footer,
        size: 'xl'
    });

    // Handle field changes
    modal.querySelectorAll('[data-field]').forEach(field => {
        field.addEventListener('change', () => {
            modal.dataset.hasChanges = 'true';
        });
        field.addEventListener('input', () => {
            modal.dataset.hasChanges = 'true';
        });
    });

    // Handle subtask toggles
    modal.querySelectorAll('[data-subtask]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            modal.dataset.hasChanges = 'true';
        });
    });

    // Handle color swatch selection
    modal.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            modal.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('is-selected'));
            swatch.classList.add('is-selected');
            modal.dataset.hasChanges = 'true';
        });
    });

    // Handle save
    footer.querySelector('[data-save]').addEventListener('click', async () => {
        const updates = {
            title: modal.querySelector('[data-field="title"]')?.textContent.trim(),
            description: modal.querySelector('[data-field="description"]')?.textContent.trim(),
            status: modal.querySelector('[data-field="status"]')?.value,
            priority: parseInt(modal.querySelector('[data-field="priority"]')?.value),
            category: normalizeCategoryId(modal.querySelector('[data-field="category"]')?.value),
            dueDate: modal.querySelector('[data-field="dueDate"]')?.value || null,
            labelColor: modal.querySelector('.color-swatch.is-selected')?.dataset.color
        };

        // Update subtasks
        const subtaskCheckboxes = modal.querySelectorAll('[data-subtask]');
        if (subtaskCheckboxes.length > 0) {
            updates.subtasks = task.subtasks.map((st, i) => ({
                ...st,
                completed: subtaskCheckboxes[i]?.checked || false
            }));
        }

        await updateTask(taskId, updates);
        Modal.close(modal);
        Toast.success('Saved', 'Task updated successfully');
    });

    // Handle delete
    footer.querySelector('[data-delete]').addEventListener('click', async () => {
        const confirmed = await Modal.confirm({
            title: 'Delete Task',
            message: `Are you sure you want to delete "${truncate(task.title, 40)}"? This action cannot be undone.`,
            confirmText: 'Delete',
            danger: true
        });

        if (confirmed) {
            await deleteTask(taskId);
            Modal.close(modal);
            Toast.success('Deleted', 'Task has been removed');
        }
    });

    // Handle share
    footer.querySelector('[data-share]').addEventListener('click', () => {
        import('./email.js').then(({ shareTaskByEmail }) => {
            shareTaskByEmail(task);
        });
    });
}

/**
 * Confirms and deletes a task
 * @param {string} taskId - Task ID
 */
async function confirmDeleteTask(taskId) {
    const task = getTask(taskId);
    if (!task) return;

    const confirmed = await Modal.confirm({
        title: 'Delete Task',
        message: `Are you sure you want to delete "${truncate(task.title, 40)}"?`,
        confirmText: 'Delete',
        danger: true
    });

    if (confirmed) {
        await deleteTask(taskId);
        Toast.success('Deleted', 'Task has been removed');
    }
}

/**
 * Shows task context menu
 * @param {HTMLElement} trigger - Trigger element
 * @param {string} taskId - Task ID
 */
function showTaskMenu(trigger, taskId) {
    const task = getTask(taskId);
    if (!task) return;

    // Simple dropdown implementation
    const existingMenu = document.querySelector('.task-menu-dropdown');
    if (existingMenu) existingMenu.remove();

    const menu = document.createElement('div');
    menu.className = 'dropdown__menu task-menu-dropdown is-visible';
    menu.style.position = 'fixed';
    
    const rect = trigger.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.left = `${rect.right - 180}px`;

    menu.innerHTML = `
        <button class="dropdown__item" data-action="edit">
            <svg class="icon icon--sm" aria-hidden="true"><use href="#icon-edit"></use></svg>
            Edit
        </button>
        <button class="dropdown__item" data-action="duplicate">
            <svg class="icon icon--sm" aria-hidden="true"><use href="#icon-copy"></use></svg>
            Duplicate
        </button>
        <button class="dropdown__item" data-action="share">
            <svg class="icon icon--sm" aria-hidden="true"><use href="#icon-external"></use></svg>
            Share via Email
        </button>
        <div class="dropdown__divider"></div>
        <button class="dropdown__item dropdown__item--danger" data-action="delete">
            <svg class="icon icon--sm" aria-hidden="true"><use href="#icon-trash"></use></svg>
            Delete
        </button>
    `;

    document.body.appendChild(menu);

    // Handle menu clicks
    menu.addEventListener('click', async (e) => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        menu.remove();

        switch (action) {
            case 'edit':
                openTaskDetailModal(taskId);
                break;
            case 'duplicate':
                const { id, createdAt, updatedAt, ...taskData } = task;
                await createTask({ ...taskData, title: `${task.title} (copy)` });
                Toast.success('Duplicated', 'Task has been copied');
                break;
            case 'share':
                import('./email.js').then(({ shareTaskByEmail }) => shareTaskByEmail(task));
                break;
            case 'delete':
                confirmDeleteTask(taskId);
                break;
        }
    });

    // Close on outside click
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

/**
 * Renders color swatches
 * @param {string} selected - Currently selected color
 * @returns {string} HTML string
 */
function renderColorSwatches(selected = '#4F46E5') {
    const colors = [
        '#DC2626', '#EA580C', '#D97706', '#CA8A04', '#65A30D',
        '#16A34A', '#059669', '#0D9488', '#0891B2', '#0284C7',
        '#2563EB', '#4F46E5', '#7C3AED', '#9333EA', '#C026D3', '#DB2777'
    ];

    return colors.map(color => `
        <button 
            type="button"
            class="color-swatch ${color === selected ? 'is-selected' : ''}"
            data-color="${color}"
            style="background-color: ${color};"
            aria-label="Color ${color}"
            title="${color}"
        ></button>
    `).join('');
}
