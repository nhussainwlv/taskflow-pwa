/**
 * Student Name : Naeem Hussain
 * ID : 2365963
 * Module Name : Project and Professionalism
 * Note: Comments in this file are kept brief and readable.
 */

/**
 * Install-prompt engagement (mirrors dissertation: 3 meaningful completions OR 60s use).
 */

const SS_START = 'tf_install_engagement_start_ms';
const SS_DONE = 'tf_install_task_completions';

export function initInstallEngagementTracking() {
    if (!sessionStorage.getItem(SS_START)) {
        sessionStorage.setItem(SS_START, String(Date.now()));
    }
}

export function recordTaskCompletionForInstall() {
    initInstallEngagementTracking();
    const n = parseInt(sessionStorage.getItem(SS_DONE) || '0', 10);
    sessionStorage.setItem(SS_DONE, String(Math.min(n + 1, 999)));
}

/** @returns {boolean} User has met behavioural threshold for respectful install UX */
export function isInstallEngagementSatisfied() {
    const started = parseInt(sessionStorage.getItem(SS_START) || '0', 10);
    if (!started) return false;
    const completions = parseInt(sessionStorage.getItem(SS_DONE) || '0', 10);
    return completions >= 3 || Date.now() - started >= 60_000;
}
