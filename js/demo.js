/**
 * Student Name : Naeem Hussain
 * ID : 2365963
 * Module Name : Project and Professionalism
 * Note: Comments in this file are kept brief and readable.
 */

/**
 * ============================================================================
 * DEMO.JS - Interactive Demo & Onboarding
 * ============================================================================
 * Guided tour showing key features to new users.
 * @module demo
 */

import { Modal, Toast } from './ui.js';
import { escapeHtml } from './utils.js';

/**
 * Demo steps configuration
 */
const DEMO_STEPS = [
    {
        title: 'Welcome to TaskFlow! 👋',
        content: `
            <p>TaskFlow is a powerful task management app that helps you organise your work and boost productivity.</p>
            <p class="mt-3">Let's take a quick tour of the key features!</p>
        `,
        image: null
    },
    {
        title: '📋 Kanban Boards',
        content: `
            <p>Visualise your workflow with our intuitive Kanban board. Tasks flow through three columns:</p>
            <ul class="demo-list mt-3">
                <li><strong>Backlog</strong> — Tasks waiting to be started</li>
                <li><strong>In Progress</strong> — Tasks you're currently working on</li>
                <li><strong>Done</strong> — Completed tasks</li>
            </ul>
            <p class="mt-3">Simply <strong>drag and drop</strong> tasks between columns to update their status!</p>
        `,
        highlight: '.board'
    },
    {
        title: '✨ Create Tasks Quickly',
        content: `
            <p>Adding tasks is easy:</p>
            <ul class="demo-list mt-3">
                <li>Click the <strong>"Add Task"</strong> button</li>
                <li>Press <kbd>N</kbd> on your keyboard</li>
                <li>Or ask the AI assistant!</li>
            </ul>
            <p class="mt-3">Each task can have a title, description, priority, due date, and colour label.</p>
        `,
        highlight: '[data-quick-add]'
    },
    {
        title: '🔍 Smart Search & Filters',
        content: `
            <p>Find tasks instantly with powerful search and filtering:</p>
            <ul class="demo-list mt-3">
                <li>Press <kbd>/</kbd> to focus the search bar</li>
                <li>Filter by status, priority, or assignee</li>
                <li>Save your favourite filter combinations as <strong>Views</strong></li>
            </ul>
        `,
        highlight: '.header__search'
    },
    {
        title: '🤖 AI Assistant',
        content: `
            <p>Meet your productivity companion! The AI assistant can help you:</p>
            <ul class="demo-list mt-3">
                <li><strong>Create tasks</strong> — "Add a task called Review report"</li>
                <li><strong>Summarise your day</strong> — "What's on my agenda?"</li>
                <li><strong>Prioritise work</strong> — "What should I do next?"</li>
            </ul>
            <p class="mt-3">Click the sparkle button in the bottom-right corner to start chatting!</p>
        `,
        highlight: '.chatbot__trigger'
    },
    {
        title: '⌨️ Keyboard Shortcuts',
        content: `
            <p>Power users love our keyboard shortcuts:</p>
            <div class="demo-shortcuts mt-3">
                <div class="demo-shortcut"><kbd>/</kbd> <span>Search tasks</span></div>
                <div class="demo-shortcut"><kbd>N</kbd> <span>New task</span></div>
                <div class="demo-shortcut"><kbd>T</kbd> <span>Toggle theme</span></div>
                <div class="demo-shortcut"><kbd>1</kbd> <span>High priority</span></div>
                <div class="demo-shortcut"><kbd>2</kbd> <span>Medium priority</span></div>
                <div class="demo-shortcut"><kbd>3</kbd> <span>Low priority</span></div>
                <div class="demo-shortcut"><kbd>?</kbd> <span>All shortcuts</span></div>
            </div>
        `,
        highlight: null
    },
    {
        title: '🎨 Themes & Customisation',
        content: `
            <p>Make TaskFlow your own:</p>
            <ul class="demo-list mt-3">
                <li>Switch between <strong>Light</strong> and <strong>Dark</strong> modes</li>
                <li>Choose custom <strong>label colours</strong> for tasks</li>
                <li>Your preferences are saved automatically</li>
            </ul>
            <p class="mt-3">Press <kbd>T</kbd> to toggle the theme anytime!</p>
        `,
        highlight: '[data-theme-toggle], [data-theme-toggle-global]'
    },
    {
        title: '📱 Works Everywhere',
        content: `
            <p>TaskFlow is a Progressive Web App (PWA):</p>
            <ul class="demo-list mt-3">
                <li><strong>Install it</strong> on your device for quick access</li>
                <li><strong>Works offline</strong> — your data is stored locally</li>
                <li><strong>Syncs automatically</strong> when you're back online</li>
            </ul>
        `,
        highlight: null
    },
    {
        title: "You're Ready! 🚀",
        content: `
            <p>That's the quick tour! Here's how to get started:</p>
            <ol class="demo-list demo-list--numbered mt-3">
                <li><strong>Create an account</strong> to save your tasks</li>
                <li><strong>Add your first task</strong> using the button or keyboard</li>
                <li><strong>Drag tasks</strong> between columns as you progress</li>
            </ol>
            <p class="mt-3">Questions? The AI assistant is always here to help!</p>
        `,
        highlight: null,
        showSignUp: true
    }
];

/**
 * Current demo state
 */
let demoState = {
    isActive: false,
    currentStep: 0,
    modal: null,
    highlightEl: null
};

/**
 * Starts the demo tour
 */
export function startDemo() {
    demoState.isActive = true;
    demoState.currentStep = 0;
    showDemoStep(0);
    console.log('[Demo] Started');
}

/**
 * Shows a specific demo step
 * @param {number} stepIndex - Step index
 */
function showDemoStep(stepIndex) {
    const step = DEMO_STEPS[stepIndex];
    if (!step) {
        endDemo();
        return;
    }

    // Remove previous highlight
    removeHighlight();

    // Create step content
    const isFirstStep = stepIndex === 0;
    const isLastStep = stepIndex === DEMO_STEPS.length - 1;

    const content = document.createElement('div');
    content.className = 'demo-step';
    content.innerHTML = `
        <div class="demo-step__content">
            ${step.content}
        </div>
        <div class="demo-step__progress">
            <span class="demo-step__counter">${stepIndex + 1} of ${DEMO_STEPS.length}</span>
            <div class="demo-step__dots">
                ${DEMO_STEPS.map((_, i) => `
                    <span class="demo-step__dot ${i === stepIndex ? 'is-active' : ''} ${i < stepIndex ? 'is-complete' : ''}"></span>
                `).join('')}
            </div>
        </div>
    `;

    // Footer with navigation
    const footer = document.createElement('div');
    footer.className = 'flex justify-between items-center';
    footer.innerHTML = `
        <button class="btn btn--ghost btn--sm" data-demo-skip>
            Skip tour
        </button>
        <div class="flex gap-2">
            ${!isFirstStep ? `
                <button class="btn btn--secondary" data-demo-prev>
                    <svg class="icon icon--sm" aria-hidden="true">
                        <use href="#icon-chevron-left"></use>
                    </svg>
                    Back
                </button>
            ` : ''}
            ${isLastStep ? `
                <button class="btn btn--primary" data-demo-finish>
                    Get Started
                    <svg class="icon icon--sm" aria-hidden="true">
                        <use href="#icon-arrow-right"></use>
                    </svg>
                </button>
            ` : `
                <button class="btn btn--primary" data-demo-next>
                    Next
                    <svg class="icon icon--sm" aria-hidden="true">
                        <use href="#icon-arrow-right"></use>
                    </svg>
                </button>
            `}
        </div>
    `;

    // Close existing modal
    if (demoState.modal) {
        Modal.close(demoState.modal);
    }

    // Open new modal
    demoState.modal = Modal.open({
        title: step.title,
        content,
        footer,
        closable: false
    });

    // Add highlight if specified
    if (step.highlight) {
        addHighlight(step.highlight);
    }

    // Attach event listeners
    footer.querySelector('[data-demo-skip]')?.addEventListener('click', () => {
        endDemo();
    });

    footer.querySelector('[data-demo-prev]')?.addEventListener('click', () => {
        demoState.currentStep--;
        showDemoStep(demoState.currentStep);
    });

    footer.querySelector('[data-demo-next]')?.addEventListener('click', () => {
        demoState.currentStep++;
        showDemoStep(demoState.currentStep);
    });

    footer.querySelector('[data-demo-finish]')?.addEventListener('click', () => {
        endDemo();
        // Open sign up modal
        import('./auth.js').then(({ openSignUpModal }) => {
            openSignUpModal();
        });
    });
}

/**
 * Adds a highlight to an element
 * @param {string} selector - CSS selector
 */
function addHighlight(selector) {
    const el = document.querySelector(selector);
    if (!el) return;

    // Create highlight overlay
    const rect = el.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.className = 'demo-highlight';
    highlight.style.cssText = `
        position: fixed;
        top: ${rect.top - 8}px;
        left: ${rect.left - 8}px;
        width: ${rect.width + 16}px;
        height: ${rect.height + 16}px;
        border: 3px solid var(--color-primary-500);
        border-radius: var(--radius-lg);
        box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
        z-index: 450;
        pointer-events: none;
        animation: pulse-highlight 2s ease-in-out infinite;
    `;

    document.body.appendChild(highlight);
    demoState.highlightEl = highlight;

    // Scroll element into view
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/**
 * Removes the current highlight
 */
function removeHighlight() {
    if (demoState.highlightEl) {
        demoState.highlightEl.remove();
        demoState.highlightEl = null;
    }
}

/**
 * Ends the demo tour
 */
function endDemo() {
    removeHighlight();
    
    if (demoState.modal) {
        Modal.close(demoState.modal);
        demoState.modal = null;
    }

    demoState.isActive = false;
    demoState.currentStep = 0;

    Toast.info('Tour complete!', 'Create an account to start using TaskFlow');
    console.log('[Demo] Ended');
}

/**
 * Checks if demo is currently active
 * @returns {boolean}
 */
export function isDemoActive() {
    return demoState.isActive;
}
