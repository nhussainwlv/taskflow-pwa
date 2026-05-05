/**
 * ============================================================================
 * A11y & UX enhancements for evaluation scenarios (offline, installability, announcements)
 * ============================================================================
 */

import { Modal, isNotificationQuietHoursEnabled, setNotificationQuietHours } from './ui.js';
import { isInstallEngagementSatisfied } from './engagement.js';

const LS_TEXT_SCALE = 'taskflow_text_scale';
const LS_CONTRAST = 'taskflow_high_contrast';

let deferredInstallPrompt = null;

/** Optional hook: appended to the Accessibility modal (e.g. voice + translator). */
let a11yPanelExtras = null;

/**
 * Registers a callback invoked with the Accessibility panel root before it opens.
 * @param {(root: HTMLElement) => void | null | undefined} fn
 */
export function registerA11yPanelExtras(fn) {
    a11yPanelExtras = typeof fn === 'function' ? fn : null;
}

/**
 * Initialise connectivity UI, motion/contrast/sync with system preferences,
 * optional install promotion, screen reader announcements.
 */
export function initA11yUx() {
    ensureAnnouncer();
    initConnectivityBanner();
    initReducedMotionDataset();
    initTextScaleFromStorage();
    initContrastPreference();
    initInstallPromptCapture();
}

function ensureAnnouncer() {
    if (document.getElementById('aria-announcer')) return;
    const el = document.createElement('div');
    el.id = 'aria-announcer';
    el.className = 'visually-hidden';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    document.body.appendChild(el);
}

/**
 * Announce text to assistive technologies (navigation, errors, connection).
 * @param {string} message
 */
export function announce(message) {
    const el = document.getElementById('aria-announcer');
    if (!el) return;
    el.textContent = '';
    // Double rAF avoids some SR coalescing
    requestAnimationFrame(() => {
        el.textContent = message;
    });
}

function initConnectivityBanner() {
    const banner = document.getElementById('connectivity-banner');
    if (!banner) return;

    const setBanner = () => {
        const online = navigator.onLine;
        banner.hidden = online;
        if (!online) {
            announce('You appear to be offline. Cached content may still be available.');
        }
    };

    setBanner();
    window.addEventListener('online', () => {
        banner.hidden = true;
        announce('Connection restored.');
    });
    window.addEventListener('offline', setBanner);

    banner.querySelector('[data-dismiss-connectivity]')?.addEventListener('click', () => {
        banner.hidden = true;
    });
}

function initReducedMotionDataset() {
    const sync = () => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        document.documentElement.dataset.reducedMotion = reduce ? '1' : '0';
    };
    sync();
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', sync);
}

export function applyTextScale(mode) {
    const root = document.documentElement;
    if (mode === 'large') {
        root.dataset.textScale = 'large';
        localStorage.setItem(LS_TEXT_SCALE, 'large');
        announce('Larger text enabled.');
    } else {
        delete root.dataset.textScale;
        localStorage.setItem(LS_TEXT_SCALE, 'normal');
        announce('Standard text size.');
    }
}

function initTextScaleFromStorage() {
    const v = localStorage.getItem(LS_TEXT_SCALE);
    if (v === 'large') {
        document.documentElement.dataset.textScale = 'large';
    }
}

export function applyHighContrast(enable) {
    const root = document.documentElement;
    if (enable) {
        root.dataset.highContrast = '1';
        localStorage.setItem(LS_CONTRAST, '1');
        announce('High contrast emphasis enabled.');
    } else {
        delete root.dataset.highContrast;
        localStorage.removeItem(LS_CONTRAST);
        announce('High contrast emphasis disabled.');
    }
}

function initContrastPreference() {
    if (localStorage.getItem(LS_CONTRAST) === '1') {
        document.documentElement.dataset.highContrast = '1';
    }
}

function initInstallPromptCapture() {
    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredInstallPrompt = e;
    });
}

/** @returns {boolean} Whether an install promotion can be attempted */
export function canPromptInstall() {
    return deferredInstallPrompt != null && isInstallEngagementSatisfied();
}

export async function promptInstallApp(buttonEl) {
    if (!deferredInstallPrompt) {
        return false;
    }
    try {
        deferredInstallPrompt.prompt();
        const outcome = await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        return outcome?.outcome === 'accepted';
    } catch (_) {
        return false;
    } finally {
        if (buttonEl) buttonEl.disabled = false;
    }
}

/**
 * Modal covering accessibility-related options usable in evaluation demos.
 */
export function openAccessibilityPanel() {
    const textLarge = localStorage.getItem(LS_TEXT_SCALE) === 'large';
    const contrastOn = localStorage.getItem(LS_CONTRAST) === '1';
    const canInstall = canPromptInstall();
    const quietNotifications = isNotificationQuietHoursEnabled();

    const content = document.createElement('div');
    content.className = 'a11y-panel';
    content.innerHTML = `
        <p class="text-sm text-secondary mb-4">
            These controls support demonstrations of Progressive Web Application usability 
            compared to native clients: resilient offline messaging, predictable install UX, keyboard access, 
            and user-adjustable typography without redeploying to an app store.
        </p>
        <fieldset class="a11y-panel__fieldset mb-4">
            <legend class="text-xs font-semibold text-tertiary uppercase tracking-wide mb-2">Display</legend>
            <label class="flex items-center gap-2 cursor-pointer py-2">
                <input type="checkbox" data-a11y-large-text ${textLarge ? 'checked' : ''} />
                <span>Larger text (in-app scale — still respects browser zoom)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer py-2">
                <input type="checkbox" data-a11y-contrast ${contrastOn ? 'checked' : ''} />
                <span>Stronger borders &amp; focus (helps low-vision users)</span>
            </label>
        </fieldset>
        <fieldset class="a11y-panel__fieldset mb-4">
            <legend class="text-xs font-semibold text-tertiary uppercase tracking-wide mb-2">Notifications</legend>
            <label class="flex items-center gap-2 cursor-pointer py-2">
                <input type="checkbox" data-a11y-quiet-hours ${quietNotifications ? 'checked' : ''} />
                <span>Quiet overnight (22:00–07:00) — browser reminders wait until morning</span>
            </label>
        </fieldset>
        <div class="a11y-panel__install mb-4">
            <button type="button" class="btn btn--primary btn--sm" data-install-pwa ${canInstall ? '' : 'disabled'}>
                Install TaskFlow to this device
            </button>
            <p class="text-xs text-tertiary mt-2" data-install-hint>${canInstall
                ? 'Uses the browser install prompt (no store review). Requires a supported browser and HTTPS.'
                : deferredInstallPrompt
                    ? 'Complete 3 tasks or use the app for a minute — then you can install without interrupting first-time exploration.'
                    : 'Install is unavailable here (often already installed, unsupported browser, or not served over HTTPS).'}</p>
        </div>
        <p class="text-xs text-tertiary">
            Reduced motion follows your OS setting (<code>prefers-reduced-motion</code>).
            Press <kbd>?</kbd> for keyboard shortcuts.
        </p>
    `;

    content.querySelector('[data-a11y-large-text]')?.addEventListener('change', e => {
        applyTextScale(e.target.checked ? 'large' : 'normal');
    });
    content.querySelector('[data-a11y-contrast]')?.addEventListener('change', e => {
        applyHighContrast(e.target.checked);
    });
    content.querySelector('[data-a11y-quiet-hours]')?.addEventListener('change', e => {
        setNotificationQuietHours(e.target.checked);
        announce(e.target.checked
            ? 'Quiet hours for notifications enabled overnight.'
            : 'Quiet hours for notifications disabled.');
    });

    const installBtn = content.querySelector('[data-install-pwa]');
    installBtn?.addEventListener('click', async () => {
        installBtn.disabled = true;
        const ok = await promptInstallApp(installBtn);
        if (!ok) installBtn.disabled = false;
        else {
            announce('TaskFlow install accepted.');
            const hint = content.querySelector('[data-install-hint]');
            if (hint) hint.textContent = 'Installation in progress.';
        }
    });

    try {
        a11yPanelExtras?.(content);
    } catch (e) {
        console.warn('[a11y] Panel extras:', e);
    }

    Modal.open({
        title: 'Accessibility & install',
        content,
        size: 'lg'
    });
}
