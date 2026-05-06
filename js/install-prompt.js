import { Modal, Toast } from './ui.js';

const POST_SIGNIN_INSTALL_PROMPT_KEY = 'tf_prompt_install_after_signin';
const INSTALL_PROMPT_DISMISSED_KEY = 'tf_install_prompt_dismissed';
const MIN_PROMPT_VISIBLE_MS = 3000;

let deferredInstallPromptEvent = null;

function isInStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIosSafari() {
    const ua = window.navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    return isIos && isSafari;
}

function markPromptHandled() {
    sessionStorage.removeItem(POST_SIGNIN_INSTALL_PROMPT_KEY);
}

function shouldShowPromptAfterSignin() {
    return sessionStorage.getItem(POST_SIGNIN_INSTALL_PROMPT_KEY) === '1';
}

function wasDismissedThisSession() {
    return sessionStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === '1';
}

function markDismissedThisSession() {
    sessionStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, '1');
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function openManualInstallHelp() {
    const isIos = isIosSafari();
    const footer = document.createElement('div');
    footer.className = 'flex gap-3 justify-end';
    footer.innerHTML = `
        <button type="button" class="btn btn--secondary" data-install-dismiss disabled>Not now (3s)</button>
    `;

    const modal = Modal.open({
        title: 'Add TaskFlow to Home Screen',
        content: isIos
            ? `
                <p class="text-secondary mb-3">Use Safari menu to add TaskFlow.</p>
                <ol class="text-sm text-secondary" style="padding-left: 1.25rem; margin: 0;">
                    <li>Tap the <strong>Share</strong> icon in Safari.</li>
                    <li>Choose <strong>Add to Home Screen</strong>.</li>
                    <li>Tap <strong>Add</strong> to install TaskFlow.</li>
                </ol>
              `
            : `
                <p class="text-secondary mb-3">Install from your browser menu:</p>
                <ol class="text-sm text-secondary" style="padding-left: 1.25rem; margin: 0;">
                    <li>Open your browser menu (<strong>...</strong> or settings icon).</li>
                    <li>Select <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
                    <li>Confirm to install TaskFlow.</li>
                </ol>
              `,
        footer,
        closable: false
    });

    const dismissBtn = footer.querySelector('[data-install-dismiss]');
    await delay(MIN_PROMPT_VISIBLE_MS);
    if (!dismissBtn) return;
    dismissBtn.disabled = false;
    dismissBtn.textContent = 'Not now';
    dismissBtn.addEventListener('click', () => {
        markDismissedThisSession();
        markPromptHandled();
        Modal.close(modal);
    });
}

async function openInstallPromptModal() {
    if (!deferredInstallPromptEvent) return false;

    return new Promise((resolve) => {
        let settled = false;
        const finish = (installed) => {
            if (settled) return;
            settled = true;
            resolve(installed);
        };

        const footer = document.createElement('div');
        footer.className = 'flex gap-3 justify-end';
        footer.innerHTML = `
            <button type="button" class="btn btn--secondary" data-install-later disabled>Not now (3s)</button>
            <button type="button" class="btn btn--primary" data-install-now disabled>Install app (3s)</button>
        `;

        const modal = Modal.open({
            title: 'Install TaskFlow',
            content: `
                <p class="text-secondary">
                    Add TaskFlow to your home screen for faster access and an app-like experience.
                </p>
            `,
            footer,
            closable: false,
            onClose: () => {
                markDismissedThisSession();
                markPromptHandled();
                finish(false);
            }
        });

        const laterBtn = footer.querySelector('[data-install-later]');
        const installBtn = footer.querySelector('[data-install-now]');
        setTimeout(() => {
            if (laterBtn) {
                laterBtn.disabled = false;
                laterBtn.textContent = 'Not now';
            }
            if (installBtn) {
                installBtn.disabled = false;
                installBtn.textContent = 'Install app';
            }
        }, MIN_PROMPT_VISIBLE_MS);

        laterBtn?.addEventListener('click', () => {
            markDismissedThisSession();
            markPromptHandled();
            Modal.close(modal);
            finish(false);
        });

        installBtn?.addEventListener('click', async () => {
            const promptEvent = deferredInstallPromptEvent;
            if (!promptEvent) {
                Modal.close(modal);
                markPromptHandled();
                finish(false);
                return;
            }

            deferredInstallPromptEvent = null;
            promptEvent.prompt();
            const result = await promptEvent.userChoice;

            if (result.outcome === 'accepted') {
                Toast.success('Installing TaskFlow', 'TaskFlow is being added to your home screen.');
            } else {
                Toast.info('Install skipped', 'You can install TaskFlow later from your browser menu.');
            }

            markPromptHandled();
            Modal.close(modal);
            finish(result.outcome === 'accepted');
        });
    });
}

export function initInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPromptEvent = event;
    });

    window.addEventListener('appinstalled', () => {
        deferredInstallPromptEvent = null;
        markPromptHandled();
        Toast.success('TaskFlow installed', 'You can now launch TaskFlow from your home screen.');
    });
}

export async function maybePromptInstallAfterSignin() {
    if (!shouldShowPromptAfterSignin() || wasDismissedThisSession() || isInStandaloneMode()) {
        return;
    }

    if (deferredInstallPromptEvent) {
        await openInstallPromptModal();
        return;
    }

    await openManualInstallHelp();
}
