/**
 * ============================================================================
 * CHATBOT.JS - AI Assistant Chatbot
 * ============================================================================
 * In-page floating AI assistant with intent-based responses.
 * Rule-based heuristics with adapter pattern for future AI API integration.
 * @module chatbot
 */

import { escapeHtml, truncate, formatDate, generateId } from './utils.js';
import { getTasks, createTask, setFilters, getState, getMember, getMembers } from './state.js';
import { Toast } from './ui.js';
import { COLUMNS, PRIORITIES } from './board.js';

/**
 * Chat message history
 * @type {Array<{id: string, role: 'user'|'assistant', content: string, timestamp: Date}>}
 */
let chatHistory = [];

/**
 * Chatbot state
 */
let chatState = {
    isOpen: false,
    isLoading: false,
    container: null
};

/**
 * AI adapter interface
 * @typedef {Object} AIAdapter
 * @property {function(string, Array): Promise<string>} chat - Process chat message
 */

/**
 * Rule-based adapter (current implementation)
 * @type {AIAdapter}
 */
const ruleBasedAdapter = {
    /**
     * Processes a chat message using rule-based heuristics
     * @param {string} message - User message
     * @param {Array} history - Chat history
     * @returns {Promise<string>} Response
     */
    async chat(message, history) {
        const intent = detectIntent(message);
        return generateResponse(intent, message);
    }
};

/**
 * API adapter stub for future AI integration
 * @type {AIAdapter}
 */
const apiAdapter = {
    /**
     * Processes message via AI API (stub)
     * @param {string} message - User message
     * @param {Array} history - Chat history
     * @returns {Promise<string>} Response
     */
    async chat(message, history) {
        // Stub for future API implementation
        // Replace with actual API call when available
        
        // Example implementation:
        // const response = await fetch('/api/ai/chat', {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ message, history })
        // });
        // const data = await response.json();
        // return data.response;

        // For now, fall back to rule-based
        return ruleBasedAdapter.chat(message, history);
    }
};

/**
 * Current AI adapter
 * @type {AIAdapter}
 */
let currentAdapter = ruleBasedAdapter;

// ============================================================================
// INTENT DETECTION
// ============================================================================

/**
 * Intent patterns and their handlers
 */
const intents = {
    CREATE_TASK: {
        patterns: [
            /create\s+(a\s+)?task/i,
            /add\s+(a\s+)?task/i,
            /new\s+task/i,
            /make\s+(a\s+)?task/i
        ],
        extract: extractTaskDetails
    },
    SUMMARIZE_TODAY: {
        patterns: [
            /summar(y|ise|ize)\s+(today|my\s+day)/i,
            /what('s|\s+is)\s+(on\s+)?my\s+(agenda|schedule|day)/i,
            /today('s)?\s+tasks/i,
            /what\s+do\s+i\s+have\s+today/i
        ]
    },
    SUGGEST_PRIORITIES: {
        patterns: [
            /suggest\s+priorit/i,
            /what\s+should\s+i\s+(work\s+on|do)\s*(first|next)?/i,
            /prioriti(z|s)e/i,
            /help\s+me\s+prioriti(z|s)e/i
        ]
    },
    FILTER_TASKS: {
        patterns: [
            /show\s+(me\s+)?(.+)\s+tasks/i,
            /filter\s+(by\s+)?(.+)/i,
            /find\s+(.+)\s+tasks/i
        ],
        extract: extractFilterCriteria
    },
    COUNT_TASKS: {
        patterns: [
            /how\s+many\s+tasks/i,
            /count\s+(my\s+)?tasks/i,
            /task\s+count/i
        ]
    },
    HELP: {
        patterns: [
            /help/i,
            /what\s+can\s+you\s+do/i,
            /how\s+do\s+i/i,
            /commands/i
        ]
    },
    GREETING: {
        patterns: [
            /^(hi|hello|hey|greetings)/i,
            /^good\s+(morning|afternoon|evening)/i
        ]
    }
};

/**
 * Detects user intent from message
 * @param {string} message - User message
 * @returns {Object} Intent object with type and extracted data
 */
function detectIntent(message) {
    for (const [type, config] of Object.entries(intents)) {
        for (const pattern of config.patterns) {
            const match = message.match(pattern);
            if (match) {
                return {
                    type,
                    match,
                    data: config.extract ? config.extract(message, match) : null
                };
            }
        }
    }
    
    return { type: 'UNKNOWN', data: null };
}

/**
 * Extracts task details from message
 * @param {string} message - User message
 * @returns {Object} Extracted task details
 */
function extractTaskDetails(message) {
    const details = {
        title: null,
        priority: 2,
        dueDate: null,
        status: 'backlog'
    };

    // Extract title (text after "create task" or similar)
    const titleMatch = message.match(/(?:create|add|new|make)\s+(?:a\s+)?task\s*(?:called|named|titled|:)?\s*["']?([^"']+?)["']?(?:\s+with|\s+due|\s+priority|$)/i);
    if (titleMatch) {
        details.title = titleMatch[1].trim();
    }

    // Extract priority
    if (/high\s+priority|priority\s*:\s*high|urgent|critical/i.test(message)) {
        details.priority = 1;
    } else if (/low\s+priority|priority\s*:\s*low/i.test(message)) {
        details.priority = 3;
    }

    // Extract due date
    const todayMatch = /due\s+(today|tonight)/i.test(message);
    const tomorrowMatch = /due\s+tomorrow/i.test(message);
    const nextWeekMatch = /due\s+next\s+week/i.test(message);

    if (todayMatch) {
        details.dueDate = new Date().toISOString().split('T')[0];
    } else if (tomorrowMatch) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        details.dueDate = tomorrow.toISOString().split('T')[0];
    } else if (nextWeekMatch) {
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        details.dueDate = nextWeek.toISOString().split('T')[0];
    }

    return details;
}

/**
 * Extracts filter criteria from message
 * @param {string} message - User message
 * @param {Array} match - Regex match
 * @returns {Object} Filter criteria
 */
function extractFilterCriteria(message) {
    const criteria = {};

    // Status
    if (/backlog|to\s*do|not\s+started/i.test(message)) {
        criteria.status = 'backlog';
    } else if (/in\s+progress|doing|working/i.test(message)) {
        criteria.status = 'in-progress';
    } else if (/done|completed|finished/i.test(message)) {
        criteria.status = 'done';
    }

    // Priority
    if (/high\s+priority|urgent/i.test(message)) {
        criteria.priority = 1;
    } else if (/medium\s+priority/i.test(message)) {
        criteria.priority = 2;
    } else if (/low\s+priority/i.test(message)) {
        criteria.priority = 3;
    }

    // Overdue
    if (/overdue|past\s+due|late/i.test(message)) {
        criteria.overdue = true;
    }

    return criteria;
}

// ============================================================================
// RESPONSE GENERATION
// ============================================================================

/**
 * Generates response based on intent
 * @param {Object} intent - Detected intent
 * @param {string} originalMessage - Original user message
 * @returns {string} Response message
 */
function generateResponse(intent, originalMessage) {
    switch (intent.type) {
        case 'CREATE_TASK':
            return handleCreateTask(intent.data, originalMessage);
        case 'SUMMARIZE_TODAY':
            return handleSummarizeToday();
        case 'SUGGEST_PRIORITIES':
            return handleSuggestPriorities();
        case 'FILTER_TASKS':
            return handleFilterTasks(intent.data);
        case 'COUNT_TASKS':
            return handleCountTasks();
        case 'HELP':
            return handleHelp();
        case 'GREETING':
            return handleGreeting();
        default:
            return handleUnknown(originalMessage);
    }
}

/**
 * Handles task creation intent
 */
function handleCreateTask(data, message) {
    if (!data?.title) {
        // Try to extract a simple title
        const simpleMatch = message.match(/(?:create|add|new)\s+(?:a\s+)?task\s+(.+)/i);
        if (simpleMatch) {
            data = { ...data, title: simpleMatch[1].trim() };
        }
    }

    if (data?.title) {
        // Create the task
        createTask({
            title: data.title,
            priority: data.priority || 2,
            dueDate: data.dueDate,
            status: data.status || 'backlog'
        });

        let response = `✅ Created task: **"${data.title}"**`;
        if (data.priority === 1) response += ' (High priority)';
        if (data.dueDate) response += ` - Due: ${formatDate(data.dueDate)}`;
        
        return response;
    }

    return "I can help you create a task! Try saying something like:\n\n• \"Create a task called Review presentation\"\n• \"Add task: Update documentation with high priority\"\n• \"New task Design homepage due tomorrow\"";
}

/**
 * Handles today summary intent
 */
function handleSummarizeToday() {
    const tasks = getTasks();
    const today = new Date().toISOString().split('T')[0];
    
    const todayTasks = tasks.filter(t => 
        t.dueDate?.startsWith(today) && t.status !== 'done'
    );
    
    const inProgress = tasks.filter(t => t.status === 'in-progress');
    const overdue = tasks.filter(t => 
        t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'done'
    );

    let summary = `📅 **Today's Summary**\n\n`;
    
    if (todayTasks.length > 0) {
        summary += `**Due Today (${todayTasks.length}):**\n`;
        todayTasks.slice(0, 5).forEach(t => {
            const priority = t.priority === 1 ? '🔴' : t.priority === 2 ? '🟡' : '🟢';
            summary += `${priority} ${t.title}\n`;
        });
        if (todayTasks.length > 5) summary += `  ...and ${todayTasks.length - 5} more\n`;
        summary += '\n';
    }

    if (inProgress.length > 0) {
        summary += `**In Progress (${inProgress.length}):**\n`;
        inProgress.slice(0, 3).forEach(t => {
            summary += `⏳ ${t.title}\n`;
        });
        if (inProgress.length > 3) summary += `  ...and ${inProgress.length - 3} more\n`;
        summary += '\n';
    }

    if (overdue.length > 0) {
        summary += `**⚠️ Overdue (${overdue.length}):**\n`;
        overdue.slice(0, 3).forEach(t => {
            summary += `❗ ${t.title}\n`;
        });
        summary += '\n';
    }

    if (todayTasks.length === 0 && inProgress.length === 0 && overdue.length === 0) {
        summary += "🎉 You're all caught up! No urgent tasks for today.";
    } else {
        const totalUrgent = todayTasks.length + overdue.length;
        summary += `\n💡 **Tip:** Focus on your ${totalUrgent} most urgent task${totalUrgent !== 1 ? 's' : ''} first.`;
    }

    return summary;
}

/**
 * Handles priority suggestions
 */
function handleSuggestPriorities() {
    const tasks = getTasks().filter(t => t.status !== 'done');
    
    if (tasks.length === 0) {
        return "🎉 Great news! You don't have any pending tasks. Time to add some new ones!";
    }

    // Score tasks based on priority and due date
    const scoredTasks = tasks.map(task => {
        let score = 0;
        
        // Priority weight
        if (task.priority === 1) score += 100;
        if (task.priority === 2) score += 50;
        
        // Due date weight
        if (task.dueDate) {
            const daysUntilDue = Math.ceil((new Date(task.dueDate) - new Date()) / (1000 * 60 * 60 * 24));
            if (daysUntilDue < 0) score += 150; // Overdue
            else if (daysUntilDue === 0) score += 100; // Due today
            else if (daysUntilDue <= 3) score += 75; // Due soon
            else if (daysUntilDue <= 7) score += 25; // Due this week
        }

        // In progress bonus
        if (task.status === 'in-progress') score += 25;

        return { ...task, score };
    }).sort((a, b) => b.score - a.score);

    let response = "🎯 **Suggested Priority Order**\n\nBased on deadlines and importance:\n\n";

    scoredTasks.slice(0, 5).forEach((task, i) => {
        const emoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'][i];
        const priority = task.priority === 1 ? '🔴' : task.priority === 2 ? '🟡' : '🟢';
        const due = task.dueDate ? ` (due ${formatDate(task.dueDate)})` : '';
        response += `${emoji} ${priority} **${task.title}**${due}\n`;
    });

    if (scoredTasks.length > 5) {
        response += `\n...and ${scoredTasks.length - 5} more tasks in your backlog.`;
    }

    response += "\n\n💡 **Tip:** Start with task #1 and work your way down!";

    return response;
}

/**
 * Handles filter tasks intent
 */
function handleFilterTasks(criteria) {
    if (!criteria || Object.keys(criteria).length === 0) {
        return "I can help you filter tasks! Try:\n\n• \"Show me high priority tasks\"\n• \"Find tasks in progress\"\n• \"Show overdue tasks\"\n• \"Filter by done status\"";
    }

    // Apply filters
    setFilters(criteria);

    const tasks = getTasks();
    let filterDesc = [];

    if (criteria.status) {
        filterDesc.push(COLUMNS.find(c => c.id === criteria.status)?.label || criteria.status);
    }
    if (criteria.priority) {
        filterDesc.push(PRIORITIES[criteria.priority]?.label + ' priority');
    }

    return `🔍 Filtered to show **${filterDesc.join(', ')}** tasks.\n\nFound **${tasks.length}** matching task${tasks.length !== 1 ? 's' : ''}.\n\n_Filters have been applied to your board._`;
}

/**
 * Handles task count intent
 */
function handleCountTasks() {
    const tasks = getTasks();
    const byStatus = {
        backlog: tasks.filter(t => t.status === 'backlog').length,
        'in-progress': tasks.filter(t => t.status === 'in-progress').length,
        done: tasks.filter(t => t.status === 'done').length
    };

    return `📊 **Task Statistics**\n\n` +
        `• **Total:** ${tasks.length} tasks\n` +
        `• **Backlog:** ${byStatus.backlog}\n` +
        `• **In Progress:** ${byStatus['in-progress']}\n` +
        `• **Done:** ${byStatus.done}\n\n` +
        `_Completion rate: ${tasks.length > 0 ? Math.round((byStatus.done / tasks.length) * 100) : 0}%_`;
}

/**
 * Handles help intent
 */
function handleHelp() {
    return `👋 **Hi! I'm your TaskFlow Assistant**\n\nI can help you with:\n\n` +
        `📝 **Create tasks**\n` +
        `"Create a task called Review report"\n` +
        `"Add urgent task: Fix bug due tomorrow"\n\n` +
        `📅 **Get summaries**\n` +
        `"What's on my agenda today?"\n` +
        `"Summarise my day"\n\n` +
        `🎯 **Prioritise work**\n` +
        `"What should I work on next?"\n` +
        `"Help me prioritise"\n\n` +
        `🔍 **Filter tasks**\n` +
        `"Show high priority tasks"\n` +
        `"Find overdue tasks"\n\n` +
        `📊 **Get stats**\n` +
        `"How many tasks do I have?"\n\n` +
        `Just type naturally and I'll do my best to help! 😊`;
}

/**
 * Handles greeting intent
 */
function handleGreeting() {
    const hour = new Date().getHours();
    let greeting;
    
    if (hour < 12) greeting = 'Good morning';
    else if (hour < 18) greeting = 'Good afternoon';
    else greeting = 'Good evening';

    const tasks = getTasks().filter(t => t.status !== 'done');
    const urgent = tasks.filter(t => t.priority === 1).length;

    let response = `${greeting}! 👋 I'm here to help you stay productive.\n\n`;
    
    if (urgent > 0) {
        response += `⚠️ You have **${urgent} high-priority task${urgent !== 1 ? 's' : ''}** waiting.\n\n`;
    }
    
    response += `Try asking me:\n• "What's on my agenda today?"\n• "Create a new task"\n• "What should I work on next?"`;

    return response;
}

/**
 * Handles unknown intent
 */
function handleUnknown(message) {
    return `I'm not sure I understood that. 🤔\n\nTry asking me to:\n` +
        `• Create a task\n` +
        `• Summarise your day\n` +
        `• Suggest priorities\n` +
        `• Filter tasks\n\n` +
        `Type "help" to see all my capabilities!`;
}

// ============================================================================
// CHATBOT UI
// ============================================================================

/**
 * Initializes the chatbot UI
 */
export function initChatbot() {
    // Create container
    const container = document.createElement('div');
    container.className = 'chatbot';
    container.innerHTML = `
        <button class="chatbot__trigger" aria-label="Open AI Assistant" data-chatbot-trigger>
            <svg class="icon icon--lg" aria-hidden="true">
                <use href="#icon-sparkles"></use>
            </svg>
        </button>
        <div class="chatbot__window" role="dialog" aria-label="AI Assistant" hidden>
            <div class="chatbot__header">
                <div class="flex items-center gap-2">
                    <svg class="icon" aria-hidden="true">
                        <use href="#icon-sparkles"></use>
                    </svg>
                    <span class="font-semibold">TaskFlow AI</span>
                </div>
                <button class="btn btn--ghost btn--icon btn--sm" data-chatbot-close aria-label="Close">
                    <svg class="icon icon--sm" aria-hidden="true">
                        <use href="#icon-x"></use>
                    </svg>
                </button>
            </div>
            <div class="chatbot__messages" role="log" aria-live="polite"></div>
            <div class="chatbot__input-area">
                <input 
                    type="text" 
                    class="chatbot__input" 
                    placeholder="Ask me anything..."
                    aria-label="Message"
                >
                <button class="btn btn--primary btn--icon" data-chatbot-send aria-label="Send">
                    <svg class="icon icon--sm" aria-hidden="true">
                        <use href="#icon-arrow-up"></use>
                    </svg>
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(container);
    chatState.container = container;

    // Attach event listeners
    const trigger = container.querySelector('[data-chatbot-trigger]');
    const closeBtn = container.querySelector('[data-chatbot-close]');
    const input = container.querySelector('.chatbot__input');
    const sendBtn = container.querySelector('[data-chatbot-send]');
    const window = container.querySelector('.chatbot__window');

    trigger.addEventListener('click', () => toggleChatbot());
    closeBtn.addEventListener('click', () => toggleChatbot(false));

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage(input.value);
            input.value = '';
        }
    });

    sendBtn.addEventListener('click', () => {
        sendMessage(input.value);
        input.value = '';
    });

    // Add welcome message
    addMessage('assistant', handleHelp());

    console.log('[Chatbot] Initialized');
}

/**
 * Toggles chatbot visibility
 * @param {boolean} [force] - Force state
 */
export function toggleChatbot(force) {
    const window = chatState.container?.querySelector('.chatbot__window');
    const trigger = chatState.container?.querySelector('.chatbot__trigger');

    if (!window || !trigger) return;

    chatState.isOpen = force !== undefined ? force : !chatState.isOpen;

    window.hidden = !chatState.isOpen;
    trigger.classList.toggle('is-active', chatState.isOpen);

    if (chatState.isOpen) {
        chatState.container.querySelector('.chatbot__input')?.focus();
    }
}

/**
 * Sends a message to the chatbot
 * @param {string} message - User message
 */
async function sendMessage(message) {
    message = message.trim();
    if (!message || chatState.isLoading) return;

    // Add user message
    addMessage('user', message);

    // Show loading state
    chatState.isLoading = true;
    const loadingId = addMessage('assistant', '...');

    try {
        // Get response
        const response = await currentAdapter.chat(message, chatHistory);

        // Replace loading with response
        updateMessage(loadingId, response);
    } catch (error) {
        console.error('[Chatbot] Error:', error);
        updateMessage(loadingId, "Sorry, I encountered an error. Please try again.");
    } finally {
        chatState.isLoading = false;
    }
}

/**
 * Adds a message to the chat
 * @param {'user'|'assistant'} role - Message role
 * @param {string} content - Message content
 * @returns {string} Message ID
 */
function addMessage(role, content) {
    const id = generateId();
    const message = { id, role, content, timestamp: new Date() };
    chatHistory.push(message);

    renderMessages();
    return id;
}

/**
 * Updates an existing message
 * @param {string} id - Message ID
 * @param {string} content - New content
 */
function updateMessage(id, content) {
    const message = chatHistory.find(m => m.id === id);
    if (message) {
        message.content = content;
        renderMessages();
    }
}

/**
 * Renders all messages
 */
function renderMessages() {
    const container = chatState.container?.querySelector('.chatbot__messages');
    if (!container) return;

    container.innerHTML = chatHistory.map(msg => `
        <div class="chatbot__message chatbot__message--${msg.role}">
            ${msg.role === 'assistant' ? `
                <div class="chatbot__avatar">
                    <svg class="icon icon--sm" aria-hidden="true">
                        <use href="#icon-sparkles"></use>
                    </svg>
                </div>
            ` : ''}
            <div class="chatbot__bubble">
                ${formatMessageContent(msg.content)}
            </div>
        </div>
    `).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;
}

/**
 * Formats message content with basic markdown
 * @param {string} content - Raw content
 * @returns {string} HTML content
 */
function formatMessageContent(content) {
    if (content === '...') {
        return '<span class="chatbot__typing"><span></span><span></span><span></span></span>';
    }

    return escapeHtml(content)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
}

// ============================================================================
// CHATBOT SERVICE
// ============================================================================

/**
 * Chatbot service facade
 */
export const ChatbotService = {
    /**
     * Processes a message and returns response
     * @param {string} message - User message
     * @returns {Promise<string>} Response
     */
    async chat(message) {
        return currentAdapter.chat(message, chatHistory);
    },

    /**
     * Switches to a different adapter
     * @param {'ruleBased'|'api'} adapterName
     */
    useAdapter(adapterName) {
        switch (adapterName) {
            case 'api':
                currentAdapter = apiAdapter;
                break;
            case 'ruleBased':
            default:
                currentAdapter = ruleBasedAdapter;
        }
        console.log(`[Chatbot] Switched to ${adapterName} adapter`);
    },

    /**
     * Clears chat history
     */
    clearHistory() {
        chatHistory = [];
        renderMessages();
    },

    /**
     * Gets chat history
     * @returns {Array} Chat history
     */
    getHistory() {
        return [...chatHistory];
    }
};
