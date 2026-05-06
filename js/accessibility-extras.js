/**
 * Student Name : Naeem Hussain
 * ID : 2365963
 * Module Name : Project and Professionalism
 * Note: Comments in this file are kept brief and readable.
 */

/**
 * Voice commands, spoken feedback (screen-reader-ish support),
 * optional Google Translate bar (requires network — third-party).
 * @module accessibility-extras
 */

import { Theme, Toast, Modal, Keyboard } from './ui.js';
import { escapeHtml } from './utils.js';
import { announce } from './a11y-ux.js';

const LS_VOICE = 'taskflow_voice_commands';
const LS_SPEAK = 'taskflow_voice_speak_feedback';
const LS_TRANSLATE = 'taskflow_google_translate';

let translateMounted = false;
let translateScriptRequested = false;
let listeningTimeoutId = null;
let voiceFabCleanup = null;

function getRecognitionCtor() {
    return typeof window !== 'undefined'
        ? (window.SpeechRecognition || window.webkitSpeechRecognition)
        : null;
}

export function speechFeedbackEnabled() {
    return localStorage.getItem(LS_SPEAK) === '1';
}

/**
 * Optionally speak brief confirmation (paired with aria-live announcements).
 */
export function maybeSpeak(text, { interrupt = false } = {}) {
    if (!speechFeedbackEnabled()) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    try {
        if (interrupt) window.speechSynthesis.cancel();

        const u = new SpeechSynthesisUtterance(text);
        u.lang = document.documentElement.lang || 'en-GB';

        const reduce = document.documentElement.dataset.reducedMotion === '1'
            || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
        u.rate = reduce ? 1 : 1.02;

        window.speechSynthesis.speak(u);
    } catch (e) {
        console.warn('[Voice] Speech synthesis unavailable:', e);
    }
}

function normalizePhrase(raw) {
    return String(raw || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[.!?]+$/g, '')
        .trim();
}

async function execVoicePhrase(phraseNorm) {
    const t = phraseNorm;
    announce(`Voice command understood: ${t}`);

    if (/^(cancel|stop|never mind|abort)$/.test(t)) {
        maybeSpeak('Cancelled.', { interrupt: true });
        return true;
    }

    if (/^close|^go back|^dismiss/.test(t)) {
        Modal.close();
        maybeSpeak('Closed dialog.');
        return true;
    }

    if (/shortcut|keyboard|help with keys/.test(t)) {
        const rows = Keyboard.getAll()
            .map(s =>
                `<div class="flex items-center justify-between p-2 rounded bg-muted text-sm gap-4">
                    <span>${escapeHtml(s.description)}</span>
                    <kbd class="text-xs">${escapeHtml(s.key)}</kbd>
                </div>`
            ).join('');
        Modal.open({
            title: 'Keyboard shortcuts',
            content: `<div class="grid gap-2">${rows || '<p class="text-sm">No shortcuts registered.</p>'}</div>`,
            size: 'lg'
        });
        maybeSpeak('Keyboard shortcuts opened.');
        return true;
    }

    if (/accessibility|^a 11/.test(t) || /\bsettings panel\b.*access/.test(t)) {
        const { openAccessibilityPanel } = await import('./a11y-ux.js');
        openAccessibilityPanel();
        maybeSpeak('Accessibility panel opened.');
        return true;
    }

    if (/^sign in|log in|^login\b/.test(t)) {
        const { openSignInModal } = await import('./auth.js');
        openSignInModal();
        maybeSpeak('Sign in form opened.');
        return true;
    }

    if (/sign up|^register|^create account/.test(t)) {
        const { openSignUpModal } = await import('./auth.js');
        openSignUpModal();
        maybeSpeak('Create account opened.');
        return true;
    }

    if (/^demo|^start demo|^tour\b/.test(t)) {
        const { startDemo } = await import('./demo.js');
        startDemo();
        maybeSpeak('Starting demo tour.');
        return true;
    }

    if (/^toggle theme|^dark mode|^light mode|^switch theme|^theme\b/.test(t)) {
        await Theme.toggle();
        maybeSpeak(`Theme switched to ${Theme.get()}.`);
        return true;
    }

    if (/\bclear\b.*filter|filters clear|clear all filter/.test(t)) {
        const { clearFilters } = await import('./state.js');
        await clearFilters();
        Toast.info('Filters', 'Filters cleared.');
        announce('Filters cleared.');
        maybeSpeak('Filters cleared.');
        return true;
    }

    if (/^filter|show filter|open filter/.test(t)) {
        const panel = document.getElementById('filter-panel');
        if (panel) {
            panel.hidden = false;
            const { initFilters } = await import('./filters.js');
            initFilters(panel);
        }
        announce('Filters panel opened.');
        maybeSpeak('Filters opened.');
        return true;
    }

    if (/^search|find task|command palette|^open search/.test(t)) {
        const { openGlobalSearch } = await import('./filters.js');
        openGlobalSearch();
        announce('Search opened.');
        maybeSpeak('Search opened.');
        return true;
    }

    if (/^board|^kanban|board view/.test(t)) {
        const { setView } = await import('./state.js');
        await setView('kanban');
        maybeSpeak('Board view.');
        return true;
    }

    if (/^list view|^show list|^task list/.test(t)) {
        const { setView } = await import('./state.js');
        await setView('list');
        maybeSpeak('List view.');
        return true;
    }

    if (/^calendar|month view/.test(t)) {
        const { setView } = await import('./state.js');
        await setView('calendar');
        maybeSpeak('Calendar view.');
        return true;
    }

    if (/^(create|add|new) task|new ticket/.test(t)) {
        const { isAuthenticated } = await import('./auth.js');
        if (!isAuthenticated()) {
            Toast.warning('Sign in required', 'Create an account or sign in to add tasks.');
            announce('Sign in required to create a task.');
            maybeSpeak('Please sign in to create a task.');
            return true;
        }
        const { openQuickAddModal } = await import('./board.js');
        openQuickAddModal('backlog');
        maybeSpeak('New task form.');
        return true;
    }

    Toast.info('Voice command', `"${t}" was not recognised. Try "help" for ideas.`);
    announce(`Unrecognised voice command: ${t}`);
    maybeSpeak('Sorry, command not recognised. Say shortcuts for examples.');
    return false;
}

let activeRecognition = null;

function stopListeningUI(btn) {
    if (btn) {
        btn.classList.remove('voice-fab--listening');
        btn.setAttribute('aria-pressed', 'false');
        btn.title = 'Voice command (tap, then speak — Chrome / Edge)';
    }
    if (listeningTimeoutId) {
        clearTimeout(listeningTimeoutId);
        listeningTimeoutId = null;
    }
    try {
        activeRecognition?.stop();
    } catch (_) {
        /* ignore */
    }
    activeRecognition = null;
}

/**
 * Starts one-shot speech recognition session (HTTPS + compatible browser required).
 */
export function startVoiceSession(triggerEl) {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
        Toast.warning(
            'Voice not supported',
            'Try Chrome or Edge over HTTPS / localhost — this browser lacks speech recognition.'
        );
        announce('Voice recognition is not available in this browser.');
        return;
    }

    if (typeof window !== 'undefined' && !window.isSecureContext) {
        Toast.warning('Voice requires secure context', 'Open TaskFlow via HTTPS or localhost.');
        return;
    }

    window.speechSynthesis?.cancel();
    stopListeningUI(triggerEl);

    try {
        const rec = new Ctor();
        rec.lang = document.documentElement.lang || 'en-GB';
        rec.continuous = false;
        rec.interimResults = false;
        rec.maxAlternatives = 1;

        listeningTimeoutId = setTimeout(() => {
            Toast.info('Voice', 'No speech detected — tap the mic again.');
            announce('Voice listening timed out.');
            maybeSpeak('Listening timed out.');
            stopListeningUI(triggerEl);
        }, 12_000);

        rec.onerror = () => {
            stopListeningUI(triggerEl);
            Toast.warning('Mic error', 'Check microphone permission and browser settings.');
        };

        rec.onend = () => {
            stopListeningUI(triggerEl);
        };

        rec.onresult = async event => {
            const raw = event.results[0]?.[0]?.transcript || '';
            const norm = normalizePhrase(raw);
            if (listeningTimeoutId) {
                clearTimeout(listeningTimeoutId);
                listeningTimeoutId = null;
            }

            triggerEl?.classList.remove('voice-fab--listening');
            triggerEl?.setAttribute('aria-pressed', 'false');

            if (!norm) return;

            Toast.info('Heard:', raw);
            if (/^(help|what can i say|\?)$/.test(norm)) {
                showVoiceHelpModal();
                return;
            }

            await execVoicePhrase(norm);
        };

        activeRecognition = rec;
        triggerEl?.classList.add('voice-fab--listening');
        triggerEl?.setAttribute('aria-pressed', 'true');
        announce('Listening for voice command.');
        maybeSpeak('Listening.', { interrupt: true });
        rec.start();
    } catch (e) {
        console.warn('[Voice] start failed:', e);
        Toast.error('Voice', 'Unable to access the microphone.');
        stopListeningUI(triggerEl);
    }
}

function showVoiceHelpModal() {
    const content = document.createElement('div');
    content.className = 'text-sm';
    content.innerHTML = `
        <p class="text-secondary mb-3">Speak clearly after tapping the microphone. Works best in Chrome or Edge.</p>
        <ul class="list-disc ps-5 space-y-1">
            <li><kbd>sign in</kbd>, <kbd>create account</kbd>, <kbd>demo</kbd></li>
            <li><kbd>new task</kbd> — quick add (signed in)</li>
            <li><kbd>board</kbd>, <kbd>list view</kbd>, <kbd>calendar</kbd></li>
            <li><kbd>filters</kbd>, <kbd>clear filters</kbd>, <kbd>search</kbd></li>
            <li><kbd>toggle theme</kbd>, <kbd>shortcuts</kbd>, <kbd>accessibility</kbd></li>
            <li><kbd>close</kbd> — dismiss top dialog</li>
        </ul>
        <p class="text-xs text-tertiary mt-3">Recognition is handled by your browser (may reach vendor speech services).</p>
    `;
    Modal.open({ title: 'Voice commands', content, size: 'md' });
    maybeSpeak('Here are examples you can say.');
}

/** Google Translate dropdown — opt-in only. */
export function enablePageTranslator(enable) {
    localStorage.setItem(LS_TRANSLATE, enable ? '1' : '0');

    if (!enable) {
        document.querySelector('.translate-widget-mount')?.setAttribute('hidden', '');
        Toast.info(
            'Translation',
            'Reload the page to fully remove Google’s translator widgets from this tab.'
        );
        announce('Translator hidden — reload to remove completely.');
        return;
    }

    document.querySelector('.translate-widget-mount')?.removeAttribute('hidden');

    if (!navigator.onLine) {
        Toast.warning('Offline', 'Translation needs an internet connection.');
        announce('Translator requires network.');
        localStorage.removeItem(LS_TRANSLATE);
        return;
    }

    mountGoogleTranslateWidget();
}

function mountGoogleTranslateWidget() {
    let mount = document.querySelector('.translate-widget-mount');
    if (!mount) {
        const skip = document.createElement('a');
        skip.href = '#main';
        skip.className = 'translate-skip visually-hidden';
        skip.textContent = 'Skip translation toolbar';

        mount = document.createElement('div');
        mount.className = 'translate-widget-mount';
        mount.setAttribute('role', 'navigation');
        mount.setAttribute('aria-label', 'Page translation toolbar');

        const inner = document.createElement('div');
        inner.id = 'google_translate_element';

        mount.appendChild(inner);

        document.body.insertBefore(skip, document.body.firstChild);
        document.body.insertBefore(mount, document.body.firstChild);
    }

    mount.removeAttribute('hidden');

    if (translateMounted) return;

    window.googleTranslateElementInit = window.googleTranslateElementInit || function tfGoogleTranslateCb() {
        try {
            if (translateMounted) return;
            if (!window.google?.translate?.TranslateElement) return;

            /* eslint-disable new-cap -- third-party TranslateElement constructor */
            new window.google.translate.TranslateElement({
                pageLanguage: 'en',
                includedLanguages: 'en,cy,es,fr,de,it,pt,pl,ar,zu',
                layout: window.google.translate.TranslateElement.InlineLayout.HORIZONTAL
            }, 'google_translate_element');
            /* eslint-enable new-cap */

            translateMounted = true;
            Toast.success('Translation', 'Toolbar added at the top. Choose a language to translate TaskFlow.');
            announce('Translate toolbar ready.');
            maybeSpeak('Page translation toolbar is ready.');
        } catch (e) {
            console.warn('[Translate]', e);
            Toast.error('Translation', 'Unable to initialise Google Translate.');
        }
    };

    if (translateScriptRequested) return;
    translateScriptRequested = true;
    const scr = document.createElement('script');
    scr.async = true;
    scr.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    scr.onerror = () => {
        Toast.error('Translation blocked', 'Script could not load (network, blocker, or privacy mode).');
        translateScriptRequested = false;
    };
    document.head.appendChild(scr);
}

function ensureVoiceFAB() {
    if (document.getElementById('taskflow-voice-fab')) return;

    const fab = document.createElement('button');
    fab.type = 'button';
    fab.id = 'taskflow-voice-fab';
    fab.className = 'voice-fab btn btn--primary';
    fab.setAttribute('aria-label', 'Voice command');
    fab.setAttribute('aria-pressed', 'false');
    fab.title = 'Voice command (tap once, then speak) — Chrome or Edge recommended';
    fab.innerHTML = `
        <svg class="icon" aria-hidden="true" width="24" height="24"><use href="#icon-mic"></use></svg>
        <span class="voice-fab__label visually-hidden">Voice</span>
    `;

    const onClick = () => startVoiceSession(fab);
    fab.addEventListener('click', onClick);

    document.body.appendChild(fab);

    voiceFabCleanup = () => {
        fab.removeEventListener('click', onClick);
        fab.remove();
        voiceFabCleanup = null;
    };
}

export function setVoiceFabVisible(show) {
    localStorage.setItem(LS_VOICE, show ? '1' : '0');
    if (show) ensureVoiceFAB();
    else {
        voiceFabCleanup?.();
        document.getElementById('taskflow-voice-fab')?.remove();
    }
}

/**
 * Appends translator & voice toggles onto the Accessibility modal body.
 */
export function attachAccessibilityPanelExtras(contentRoot) {
    const box = document.createElement('div');
    box.innerHTML = `
        <fieldset class="a11y-panel__fieldset mb-4">
            <legend class="text-xs font-semibold text-tertiary uppercase tracking-wide mb-2">Translation</legend>
            <p class="text-xs text-secondary mb-2">
                Optional Google Toolbar — sends page text for translation while you browse. Requires internet and accepts Google’s terms where applicable.
            </p>
            <label class="flex items-center gap-2 cursor-pointer py-2">
                <input type="checkbox" data-tf-google-translate 
                    ${localStorage.getItem(LS_TRANSLATE) === '1' ? 'checked' : ''} />
                <span>Show “Translate page” toolbar (many languages)</span>
            </label>
        </fieldset>
        <fieldset class="a11y-panel__fieldset mb-4">
            <legend class="text-xs font-semibold text-tertiary uppercase tracking-wide mb-2">Voice</legend>
            <label class="flex items-center gap-2 cursor-pointer py-2">
                <input type="checkbox" data-tf-voice-fab ${localStorage.getItem(LS_VOICE) === '1' ? 'checked' : ''} />
                <span>Show floating microphone (voice navigation)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer py-2">
                <input type="checkbox" data-tf-speak-feedback ${speechFeedbackEnabled() ? 'checked' : ''} />
                <span>Also speak short confirmations aloud (speech synthesis)</span>
            </label>
            <div class="flex flex-wrap gap-2 mt-2">
                <button type="button" class="btn btn--secondary btn--sm" data-tf-speech-test>Test spoken feedback</button>
                <button type="button" class="btn btn--ghost btn--sm" data-tf-voice-help>Phrase list…</button>
            </div>
            <p class="text-xs text-tertiary mt-3">
                Mic uses the Web Speech API (Chrome / Edge recommended). Shortcut: <kbd>ctrl</kbd>+<kbd>shift</kbd>+<kbd>m</kbd> (also <kbd>⌘</kbd>+<kbd>shift</kbd>+<kbd>m</kbd>) toggles mic listen when the mic button exists.
            </p>
        </fieldset>
    `;

    box.querySelector('[data-tf-google-translate]')?.addEventListener('change', e =>
        enablePageTranslator(e.target.checked)
    );

    box.querySelector('[data-tf-voice-fab]')?.addEventListener('change', e =>
        setVoiceFabVisible(e.target.checked)
    );

    box.querySelector('[data-tf-speak-feedback]')?.addEventListener('change', e =>
        localStorage.setItem(LS_SPEAK, e.target.checked ? '1' : '0')
    );

    box.querySelector('[data-tf-speech-test]')?.addEventListener('click', () => {
        localStorage.setItem(LS_SPEAK, '1');
        maybeSpeak('Spoken feedback is working. You will hear confirmations when voice commands succeed.', {
            interrupt: true
        });
    });

    box.querySelector('[data-tf-voice-help]')?.addEventListener('click', () => showVoiceHelpModal());

    contentRoot.appendChild(box);
}

/** Run after DOM + Keyboard ready. */
export function initAccessibilityExtras() {
    if (localStorage.getItem(LS_TRANSLATE) === '1' && navigator.onLine) {
        mountGoogleTranslateWidget();
    }
    if (localStorage.getItem(LS_VOICE) === '1') {
        ensureVoiceFAB();
    }

    Keyboard.register('ctrl+shift+m', {
        handler: () => {
            if (localStorage.getItem(LS_VOICE) !== '1') return;
            const btn = document.getElementById('taskflow-voice-fab');
            if (btn) startVoiceSession(btn);
        },
        description: 'Voice command (listen once)',
        global: true
    });
}
