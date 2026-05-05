/**
 * ============================================================================
 * EMAIL.JS - Email Sharing & Notifications
 * ============================================================================
 * Email composition, sharing, and mock invite functionality.
 * Uses mailto: for current implementation, with adapter pattern for future API.
 * @module email
 */

import { escapeHtml, formatDate, getInitials, truncate } from './utils.js';
import { getMember, getState, addMember, getCategoryLabel } from './state.js';
import { Toast, Modal } from './ui.js';
import { COLUMNS, PRIORITIES } from './board.js';

/**
 * Email adapter interface for swappable implementations
 * @typedef {Object} EmailAdapter
 * @property {function(Object): Promise<boolean>} send - Send email
 * @property {function(Object): Promise<boolean>} invite - Send invite
 */

/**
 * Mailto adapter - uses mailto: links (current implementation)
 * @type {EmailAdapter}
 */
const mailtoAdapter = {
    /**
     * Opens email client with pre-filled email
     * @param {Object} options - Email options
     * @returns {Promise<boolean>} Success status
     */
    async send({ to, subject, body, cc = '', bcc = '' }) {
        try {
            const params = new URLSearchParams();
            if (subject) params.set('subject', subject);
            if (body) params.set('body', body);
            if (cc) params.set('cc', cc);
            if (bcc) params.set('bcc', bcc);

            const mailto = `mailto:${encodeURIComponent(to || '')}?${params.toString()}`;
            window.location.href = mailto;

            return true;
        } catch (error) {
            console.error('[Email] Failed to open mailto:', error);
            return false;
        }
    },

    /**
     * Sends an invite email (mock - opens mailto)
     * @param {Object} options - Invite options
     * @returns {Promise<boolean>} Success status
     */
    async invite({ email, role, workspaceName }) {
        const subject = `You've been invited to join ${workspaceName} on TaskFlow`;
        const body = `
Hi there,

You've been invited to join "${workspaceName}" on TaskFlow as a ${role}.

TaskFlow is a powerful task management tool that helps teams collaborate and stay organized.

Click the link below to accept the invitation:
[Invitation link would go here]

Best regards,
The TaskFlow Team
        `.trim();

        return this.send({ to: email, subject, body });
    }
};

/**
 * SMTP/API adapter stub for future implementation
 * @type {EmailAdapter}
 */
const apiAdapter = {
    /**
     * Sends email via API (stub)
     * @param {Object} options - Email options
     * @returns {Promise<boolean>} Success status
     */
    async send({ to, subject, body, cc, bcc }) {
        // Stub for future API implementation
        // Replace with actual API call when backend is available
        console.log('[Email] API send called (stub):', { to, subject, body, cc, bcc });

        // Example implementation:
        // const response = await fetch('/api/email/send', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ to, subject, body, cc, bcc })
        // });
        // return response.ok;

        // For now, fall back to mailto
        return mailtoAdapter.send({ to, subject, body, cc, bcc });
    },

    /**
     * Sends invite via API (stub)
     * @param {Object} options - Invite options
     * @returns {Promise<boolean>} Success status
     */
    async invite({ email, role, workspaceName }) {
        console.log('[Email] API invite called (stub):', { email, role, workspaceName });
        return mailtoAdapter.invite({ email, role, workspaceName });
    }
};

/**
 * Current email adapter
 * @type {EmailAdapter}
 */
let currentAdapter = mailtoAdapter;

/**
 * Email service facade
 */
export const EmailService = {
    /**
     * Sends an email
     * @param {Object} options - Email options
     * @returns {Promise<boolean>}
     */
    send: (options) => currentAdapter.send(options),

    /**
     * Sends an invite
     * @param {Object} options - Invite options
     * @returns {Promise<boolean>}
     */
    invite: (options) => currentAdapter.invite(options),

    /**
     * Switches to a different adapter
     * @param {'mailto'|'api'} adapterName
     */
    useAdapter(adapterName) {
        switch (adapterName) {
            case 'api':
                currentAdapter = apiAdapter;
                break;
            case 'mailto':
            default:
                currentAdapter = mailtoAdapter;
        }
        console.log(`[Email] Switched to ${adapterName} adapter`);
    }
};

// ============================================================================
// TASK SHARING
// ============================================================================

/**
 * Shares a task via email
 * @param {Object} task - Task to share
 */
export function shareTaskByEmail(task) {
    if (!task) return;

    const column = COLUMNS.find(c => c.id === task.status);
    const priority = PRIORITIES[task.priority];
    const assignees = task.assignees
        ?.map(id => getMember(id))
        .filter(Boolean)
        .map(m => m.name)
        .join(', ') || 'Unassigned';

    const subject = `[TaskFlow] ${task.title}`;

    const body = `
Task: ${task.title}
Status: ${column?.label || task.status}
Priority: ${priority?.label || 'Medium'}
Category: ${getCategoryLabel(task.category)}
Due Date: ${task.dueDate ? formatDate(task.dueDate) : 'Not set'}
Assignees: ${assignees}

Description:
${task.description || 'No description'}

${task.subtasks?.length > 0 ? `
Subtasks:
${task.subtasks.map(st => `- [${st.completed ? 'x' : ' '}] ${st.title}`).join('\n')}
` : ''}

---
Shared from TaskFlow
    `.trim();

    EmailService.send({ subject, body });
    Toast.info('Opening email client', 'Compose your message to share this task');
}

/**
 * Opens the share task modal
 * @param {Object} task - Task to share
 */
export function openShareTaskModal(task) {
    const content = `
        <form id="share-form" class="form">
            <div class="form-group">
                <label class="label label--required" for="share-email">Recipient Email</label>
                <input 
                    type="email" 
                    id="share-email" 
                    class="input" 
                    placeholder="colleague@company.com"
                    required
                >
            </div>
            <div class="form-group">
                <label class="label" for="share-message">Add a message (optional)</label>
                <textarea 
                    id="share-message" 
                    class="input" 
                    rows="3"
                    placeholder="Check out this task..."
                ></textarea>
            </div>
            <div class="card card--elevated p-4 mt-4">
                <h4 class="text-sm font-semibold mb-2">Task Preview</h4>
                <p class="font-medium">${escapeHtml(task.title)}</p>
                <p class="text-sm text-tertiary mt-1">${escapeHtml(truncate(task.description, 100))}</p>
            </div>
        </form>
    `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
        <button type="button" class="btn btn--secondary" data-dismiss>Cancel</button>
        <button type="submit" form="share-form" class="btn btn--primary">
            <svg class="icon icon--sm" aria-hidden="true">
                <use href="#icon-external"></use>
            </svg>
            Share
        </button>
    `;

    const modal = Modal.open({
        title: 'Share Task',
        content,
        footer
    });

    const form = modal.querySelector('#share-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = form.querySelector('#share-email').value;
        const message = form.querySelector('#share-message').value;

        const column = COLUMNS.find(c => c.id === task.status);
        const subject = `[TaskFlow] ${task.title}`;
        const body = `
${message ? message + '\n\n---\n\n' : ''}Task: ${task.title}
Status: ${column?.label || task.status}
${task.description ? `\nDescription:\n${task.description}` : ''}

---
Shared from TaskFlow
        `.trim();

        EmailService.send({ to: email, subject, body });
        Modal.close(modal);
        Toast.success('Email opened', `Sharing task with ${email}`);
    });

    footer.querySelector('[data-dismiss]').addEventListener('click', () => {
        Modal.close(modal);
    });
}

// ============================================================================
// MEMBER INVITES
// ============================================================================

/**
 * Opens the invite member modal
 */
export function openInviteMemberModal() {
    const content = `
        <form id="invite-form" class="form">
            <div class="form-group">
                <label class="label label--required" for="invite-email">Email Address</label>
                <input 
                    type="email" 
                    id="invite-email" 
                    class="input" 
                    placeholder="newmember@company.com"
                    required
                >
            </div>
            <div class="form-group">
                <label class="label" for="invite-name">Name (optional)</label>
                <input 
                    type="text" 
                    id="invite-name" 
                    class="input" 
                    placeholder="John Doe"
                >
            </div>
            <div class="form-group">
                <label class="label" for="invite-role">Role</label>
                <select id="invite-role" class="input select">
                    <option value="viewer">Viewer - Can view tasks</option>
                    <option value="editor" selected>Editor - Can edit tasks</option>
                    <option value="owner">Owner - Full access</option>
                </select>
            </div>
            <div class="form-hint">
                <svg class="icon icon--sm" aria-hidden="true">
                    <use href="#icon-info"></use>
                </svg>
                An invitation email will be sent to this address.
            </div>
        </form>
    `;

    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
        <button type="button" class="btn btn--secondary" data-dismiss>Cancel</button>
        <button type="submit" form="invite-form" class="btn btn--primary">
            <svg class="icon icon--sm" aria-hidden="true">
                <use href="#icon-user-plus"></use>
            </svg>
            Send Invite
        </button>
    `;

    const modal = Modal.open({
        title: 'Invite Team Member',
        content,
        footer
    });

    const form = modal.querySelector('#invite-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.querySelector('#invite-email').value;
        const name = form.querySelector('#invite-name').value || email.split('@')[0];
        const role = form.querySelector('#invite-role').value;

        // Add member to state (mock)
        await addMember({ email, name, role });

        // Send invite email
        const workspace = getState('workspaces')?.find(w => w.id === getState('currentWorkspaceId'));
        await EmailService.invite({
            email,
            role,
            workspaceName: workspace?.name || 'TaskFlow Workspace'
        });

        Modal.close(modal);
        Toast.success('Invite sent', `${name} has been invited as ${role}`);
    });

    footer.querySelector('[data-dismiss]').addEventListener('click', () => {
        Modal.close(modal);
    });
}

// ============================================================================
// NOTIFICATION EMAILS
// ============================================================================

/**
 * Composes a task assignment notification email
 * @param {Object} task - Task object
 * @param {string} assigneeId - Assignee member ID
 * @returns {Object} Email data
 */
export function composeAssignmentEmail(task, assigneeId) {
    const assignee = getMember(assigneeId);
    if (!assignee) return null;

    const column = COLUMNS.find(c => c.id === task.status);

    return {
        to: assignee.email,
        subject: `[TaskFlow] You've been assigned: ${task.title}`,
        body: `
Hi ${assignee.name},

You've been assigned a new task:

Task: ${task.title}
Status: ${column?.label || task.status}
Due Date: ${task.dueDate ? formatDate(task.dueDate) : 'Not set'}

${task.description ? `Description:\n${task.description}\n` : ''}

View this task in TaskFlow to get started.

Best,
TaskFlow
        `.trim()
    };
}

/**
 * Composes a due date reminder email
 * @param {Object} task - Task object
 * @returns {Object} Email data
 */
export function composeDueReminderEmail(task) {
    const assignees = task.assignees
        ?.map(id => getMember(id))
        .filter(Boolean) || [];

    if (assignees.length === 0) return null;

    return {
        to: assignees.map(a => a.email).join(', '),
        subject: `[TaskFlow] Reminder: "${task.title}" is due ${formatDate(task.dueDate)}`,
        body: `
Hi team,

This is a reminder that the following task is due soon:

Task: ${task.title}
Due: ${formatDate(task.dueDate)}

${task.description ? `Description:\n${task.description}\n` : ''}

Please ensure this task is completed on time.

Best,
TaskFlow
        `.trim()
    };
}

/**
 * Sends a batch of emails (mock implementation)
 * @param {Array<Object>} emails - Array of email objects
 * @returns {Promise<Object>} Results
 */
export async function sendBatchEmails(emails) {
    const results = {
        sent: 0,
        failed: 0,
        errors: []
    };

    for (const email of emails) {
        try {
            // In a real implementation, this would queue emails for sending
            console.log('[Email] Would send:', email);
            results.sent++;
        } catch (error) {
            results.failed++;
            results.errors.push({ email: email.to, error: error.message });
        }
    }

    return results;
}

// ============================================================================
// EXPORT FOR EXTERNAL USE
// ============================================================================

/**
 * Creates a mailto link for a task
 * @param {Object} task - Task object
 * @returns {string} Mailto URL
 */
export function createTaskMailtoLink(task) {
    const column = COLUMNS.find(c => c.id === task.status);
    const priority = PRIORITIES[task.priority];

    const subject = encodeURIComponent(`[TaskFlow] ${task.title}`);
    const body = encodeURIComponent(`
Task: ${task.title}
Status: ${column?.label || task.status}
Priority: ${priority?.label || 'Medium'}
${task.dueDate ? `Due: ${formatDate(task.dueDate)}` : ''}

${task.description || ''}

---
Shared from TaskFlow
    `.trim());

    return `mailto:?subject=${subject}&body=${body}`;
}
