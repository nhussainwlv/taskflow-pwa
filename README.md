# TaskFlow

A modern, accessible task management web application built with **vanilla HTML, CSS, and JavaScript** — no frameworks, no dependencies.

**Built by [Naeem Hussain](mailto:n.hussain30@wlv.ac.uk)**

![TaskFlow Screenshot](./assets/screenshot.png)

## ✨ Features

### Core Functionality
- **Kanban Board** - Drag-and-drop tasks between Backlog, In Progress, and Done columns
- **Rich Task Management** - Title, description, status, priority, due dates, labels, assignees, subtasks, comments
- **Smart Filtering** - Filter by status, priority, assignee, or search terms
- **Saved Views** - Save and quickly apply custom filter combinations
- **Bulk Actions** - Select and update multiple tasks at once

### Collaboration
- **Workspaces & Projects** - Organise tasks into logical groups
- **Team Members** - Add members with role-based permissions (Owner, Editor, Viewer)
- **Email Sharing** - Share tasks via email with pre-filled mailto links
- **Avatar Initials** - Visual member identification

### AI Assistant
- **Natural Language** - Create tasks by describing them: "Create task called Review report"
- **Smart Summaries** - "What's on my agenda today?"
- **Priority Suggestions** - "What should I work on next?"
- **Rule-Based** - Works offline with intent detection, easily swappable for real AI API

### Accessibility (WCAG 2.1 AA)
- **High Contrast** - Colour palette tested for ≥4.5:1 contrast ratios
- **Keyboard Navigation** - Full keyboard support with shortcuts (`/`, `N`, `T`, `1-3`)
- **Screen Reader Friendly** - Semantic HTML, ARIA labels, and live regions
- **Focus Visible** - Clear focus indicators on all interactive elements
- **Reduced Motion** - Respects `prefers-reduced-motion`

### Offline & Performance
- **Service Worker** - Works offline with intelligent caching strategies
- **localStorage** - Persistent data with adapter pattern for easy API migration
- **No External Dependencies** - Pure vanilla implementation
- **Lazy Loading** - Deferred loading of non-critical assets
- **Zero Layout Shift** - Stable UI during load

### Theming
- **Light/Dark Modes** - Automatic detection via `prefers-color-scheme`
- **CSS Variables** - Easy customisation of colours, spacing, and typography
- **Print Styles** - Clean task detail printing

## 📁 Project Structure

```
TaskFlowPwa/
├── html/
│   └── index.html          # Main application HTML
├── css/
│   ├── reset.css           # Modern CSS reset
│   ├── variables.css       # Design tokens (colors, spacing, etc.)
│   ├── theme.css           # Base typography & utilities
│   ├── components.css      # Reusable UI components
│   └── app.css             # Application-specific styles
├── js/
│   ├── app.js              # Main entry point
│   ├── state.js            # State management
│   ├── ui.js               # UI components (toasts, modals, etc.)
│   ├── board.js            # Kanban board logic
│   ├── filters.js          # Filtering & search
│   ├── storage.js          # Storage adapter (localStorage/IndexedDB)
│   ├── email.js            # Email sharing functionality
│   ├── chatbot.js          # AI assistant
│   └── utils.js            # Helper functions
├── assets/
│   ├── favicon.svg         # App icon
│   └── icon-*.png          # PWA icons (various sizes)
├── sw.js                   # Service Worker
├── manifest.json           # PWA manifest
└── README.md               # This file
```

## 🚀 Getting Started

### Quick Start

1. **Clone or download** this repository
2. **Start a local server** (required for ES modules):
   ```bash
   # Python
   python3 -m http.server 8080

   # Node.js
   npx serve

   # PHP
   php -S localhost:8080
   ```
3. **Open** `https://taskflow-pwa.onrender.com/html/index.html` in your browser

### Demo Data

On first load, the app seeds itself with sample tasks and team members so you can explore all features immediately.

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `/` | Focus search |
| `N` | New task |
| `T` | Toggle theme |
| `1` | Set high priority |
| `2` | Set medium priority |
| `3` | Set low priority |
| `⌘/Ctrl + K` | Open command palette |
| `?` | Show all shortcuts |
| `Escape` | Close modal/dropdown |

## 🎨 Customisation

### Colours

Edit `css/variables.css` to customise the colour palette:

```css
:root {
    --color-primary-600: #4F46E5;  /* Main brand colour */
    --color-success-500: #22C55E;  /* Success states */
    --color-warning-500: #F59E0B;  /* Warning states */
    --color-danger-500: #EF4444;   /* Error/danger states */
}
```

### Typography

```css
:root {
    --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --text-base: clamp(0.875rem, 0.825rem + 0.25vw, 1rem);
}
```

### Spacing

Uses a 4px base grid:
```css
:root {
    --space-1: 4px;
    --space-2: 8px;
    --space-4: 16px;
    --space-6: 24px;
}
```

## 🔌 Extending

### Adding a Real AI Backend

The chatbot uses an adapter pattern. Replace the rule-based adapter with an API call:

```javascript
// In js/chatbot.js
const apiAdapter = {
    async chat(message, history) {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, history })
        });
        const data = await response.json();
        return data.response;
    }
};

// Switch adapter
ChatbotService.useAdapter('api');
```

### Adding API Storage

Replace localStorage with your API:

```javascript
// In js/storage.js
const apiAdapter = {
    async get(key) {
        const response = await fetch(`/api/storage/${key}`);
        return response.json();
    },
    async set(key, value) {
        await fetch(`/api/storage/${key}`, {
            method: 'PUT',
            body: JSON.stringify(value)
        });
    }
};

// Switch adapter
storage.useAdapter('api');
```

### Adding Real Email Sending

Replace mailto with SMTP/API:

```javascript
// In js/email.js
const apiAdapter = {
    async send({ to, subject, body }) {
        await fetch('/api/email/send', {
            method: 'POST',
            body: JSON.stringify({ to, subject, body })
        });
        return true;
    }
};

EmailService.useAdapter('api');
```

## 📱 PWA Installation

TaskFlow can be installed as a Progressive Web App:

1. Open the app in Chrome, Edge, or Safari
2. Click the install prompt or use the browser menu
3. The app will be added to your home screen/applications

## 🧪 Browser Support

- Chrome/Edge 88+
- Firefox 78+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome for Android)

## 📄 License

© 2026 TaskFlow PWA. University of Wolverhampton Project.

## 🙏 Credits

Built with:
- [Inter Font](https://rsms.me/inter/) - Beautiful, readable typeface
- Inspired by [monday.com](https://monday.com) for UX patterns

---

Made with ❤️ by **Naeem Hussain** — using only vanilla HTML, CSS, and JavaScript.

[n.hussain30@wlv.ac.uk](mailto:n.hussain30@wlv.ac.uk)
