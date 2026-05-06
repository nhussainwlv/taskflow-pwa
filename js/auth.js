/**
 * ============================================================================
 * AUTH.JS - Authentication Module
 * ============================================================================
 * Handles user sign-in, sign-up, and session management.
 * Uses localStorage for demo purposes - easily swappable for real API.
 * @module auth
 */

import { generateId, escapeHtml, getInitials } from './utils.js';
import { storage } from './storage.js';
import { Toast, Modal } from './ui.js';

/**
 * Authentication state
 */
let currentUser = null;
let authListeners = [];

/**
 * Storage keys
 */
const USERS_KEY = 'users';
const SESSION_KEY = 'session';
const POST_SIGNIN_INSTALL_PROMPT_KEY = 'tf_prompt_install_after_signin';

/**
 * Gets the current authenticated user
 * @returns {Object|null} Current user or null
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * Checks if a user is signed in
 * @returns {boolean}
 */
export function isAuthenticated() {
    return currentUser !== null;
}

/**
 * Subscribes to authentication state changes
 * @param {Function} callback - Callback function
 * @returns {Function} Unsubscribe function
 */
export function onAuthStateChange(callback) {
    authListeners.push(callback);
    return () => {
        authListeners = authListeners.filter(cb => cb !== callback);
    };
}

/**
 * Notifies all auth listeners
 */
function notifyAuthChange() {
    authListeners.forEach(cb => cb(currentUser));
}

/**
 * Initialises authentication from stored session
 */
export async function initAuth() {
    const session = await storage.get(SESSION_KEY);
    if (session && session.userId) {
        const users = await storage.get(USERS_KEY) || [];
        currentUser = users.find(u => u.id === session.userId) || null;
        if (currentUser) {
            console.log('[Auth] Session restored for:', currentUser.email);
        }
    }
    notifyAuthChange();
}

/**
 * Signs up a new user
 * @param {Object} userData - User data
 * @returns {Promise<Object>} Created user
 */
export async function signUp({ name, email, password }) {
    // Validate inputs
    if (!name || !email || !password) {
        throw new Error('All fields are required');
    }

    if (!isValidEmail(email)) {
        throw new Error('Please enter a valid email address');
    }

    if (password.length < 6) {
        throw new Error('Password must be at least 6 characters');
    }

    // Check if user exists
    const users = await storage.get(USERS_KEY) || [];
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
        throw new Error('An account with this email already exists');
    }

    // Create user
    const user = {
        id: generateId(),
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash: await hashPassword(password),
        createdAt: new Date().toISOString()
    };

    // Save user
    users.push(user);
    await storage.set(USERS_KEY, users);

    // Sign in the new user
    await createSession(user);

    console.log('[Auth] User registered:', user.email);
    return user;
}

/**
 * Signs in an existing user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<Object>} Signed in user
 */
export async function signIn(email, password) {
    if (!email || !password) {
        throw new Error('Email and password are required');
    }

    const users = await storage.get(USERS_KEY) || [];
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
        throw new Error('No account found with this email');
    }

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
        throw new Error('Incorrect password');
    }

    await createSession(user);

    console.log('[Auth] User signed in:', user.email);
    return user;
}

/**
 * Signs out the current user
 */
export async function signOut() {
    const email = currentUser?.email;
    currentUser = null;
    await storage.remove(SESSION_KEY);
    notifyAuthChange();
    console.log('[Auth] User signed out:', email);
}

/**
 * Clears all TaskFlow storage (tasks, workspaces, demo data, sessions, accounts).
 * Matches dissertation / GDPR portability and erasure demonstrator expectations.
 */
export async function eraseAllLocalWorkspaceDataAndSignOut() {
    await storage.clear();
    currentUser = null;
    notifyAuthChange();
    console.log('[Auth] Full local wipe completed');
}

/**
 * Updates the signed-in user (local demo storage).
 * @param {Object} data
 * @param {string} data.name - Display name
 * @param {string} data.email - Email address
 * @param {string} [data.currentPassword]
 * @param {string} [data.newPassword]
 */
export async function updateProfile({ name, email, currentPassword, newPassword }) {
    if (!currentUser) {
        throw new Error('Not signed in');
    }

    const users = await storage.get(USERS_KEY) || [];
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx === -1) {
        throw new Error('User record not found');
    }

    const stored = users[idx];
    const nextEmail = email ? email.toLowerCase().trim() : stored.email;
    const nextName = name != null ? name.trim() : stored.name;

    if (!nextName) {
        throw new Error('Name is required');
    }
    if (!isValidEmail(nextEmail)) {
        throw new Error('Please enter a valid email address');
    }
    if (nextEmail !== stored.email &&
        users.some(u => u.id !== stored.id && u.email.toLowerCase() === nextEmail)) {
        throw new Error('An account already uses this email');
    }

    if (newPassword) {
        if (newPassword.length < 6) {
            throw new Error('New password must be at least 6 characters');
        }
        if (!currentPassword) {
            throw new Error('Enter your current password to set a new one');
        }
        const ok = await verifyPassword(currentPassword, stored.passwordHash);
        if (!ok) {
            throw new Error('Current password is incorrect');
        }
        stored.passwordHash = await hashPassword(newPassword);
    }

    stored.name = nextName;
    stored.email = nextEmail;

    users[idx] = stored;
    await storage.set(USERS_KEY, users);
    await createSession(stored);
    console.log('[Auth] Profile updated:', stored.email);
}

/**
 * Creates a session for a user
 * @param {Object} user - User object
 */
async function createSession(user) {
    currentUser = {
        id: user.id,
        name: user.name,
        email: user.email
    };

    await storage.set(SESSION_KEY, {
        userId: user.id,
        createdAt: new Date().toISOString()
    });

    // Let app startup know this session came from an active sign-in/sign-up action.
    sessionStorage.setItem(POST_SIGNIN_INSTALL_PROMPT_KEY, '1');

    notifyAuthChange();
}

/**
 * Hashes a password (simple hash for demo - use bcrypt in production)
 * @param {string} password - Plain password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
    // Using SubtleCrypto for demo - in production use bcrypt
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'taskflow_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verifies a password against a hash
 * @param {string} password - Plain password
 * @param {string} hash - Stored hash
 * @returns {Promise<boolean>}
 */
async function verifyPassword(password, hash) {
    const inputHash = await hashPassword(password);
    return inputHash === hash;
}

/**
 * Validates an email address
 * @param {string} email - Email to validate
 * @returns {boolean}
 */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ============================================================================
// AUTH UI COMPONENTS
// ============================================================================

/**
 * Opens the sign-in modal
 */
export function openSignInModal() {
    const content = `
        <form id="signin-form" class="auth-form">
            <div class="form-group">
                <label class="label label--required" for="signin-email">Email Address</label>
                <input 
                    type="email" 
                    id="signin-email" 
                    class="input" 
                    placeholder="you@example.com"
                    required
                    autocomplete="email"
                >
            </div>
            <div class="form-group">
                <label class="label label--required" for="signin-password">Password</label>
                <input 
                    type="password" 
                    id="signin-password" 
                    class="input" 
                    placeholder="Enter your password"
                    required
                    autocomplete="current-password"
                >
            </div>
            <div class="auth-form__error" id="signin-error" hidden></div>
            <button type="submit" class="btn btn--primary btn--lg w-full mt-4">
                Sign In
            </button>
            <p class="auth-form__footer">
                Don't have an account? <button type="button" class="link" data-switch-to-signup>Create one</button>
            </p>
        </form>
    `;

    const modal = Modal.open({
        title: 'Welcome Back',
        content,
        size: ''
    });

    const form = modal.querySelector('#signin-form');
    const errorEl = modal.querySelector('#signin-error');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.hidden = true;

        const email = form.querySelector('#signin-email').value;
        const password = form.querySelector('#signin-password').value;

        try {
            const submitBtn = form.querySelector('[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner spinner--sm"></span> Signing in...';

            await signIn(email, password);
            Modal.close(modal);
            Toast.success('Welcome back!', `Signed in as ${email}`);
            
            // Refresh page to update UI
            window.location.reload();
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.hidden = false;
            const submitBtn = form.querySelector('[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Sign In';
        }
    });

    modal.querySelector('[data-switch-to-signup]')?.addEventListener('click', () => {
        Modal.close(modal);
        openSignUpModal();
    });
}

/**
 * Opens the sign-up modal
 */
export function openSignUpModal() {
    const content = `
        <form id="signup-form" class="auth-form">
            <div class="form-group">
                <label class="label label--required" for="signup-name">Full Name</label>
                <input 
                    type="text" 
                    id="signup-name" 
                    class="input" 
                    placeholder="John Smith"
                    required
                    autocomplete="name"
                >
            </div>
            <div class="form-group">
                <label class="label label--required" for="signup-email">Email Address</label>
                <input 
                    type="email" 
                    id="signup-email" 
                    class="input" 
                    placeholder="you@example.com"
                    required
                    autocomplete="email"
                >
            </div>
            <div class="form-group">
                <label class="label label--required" for="signup-password">Password</label>
                <input 
                    type="password" 
                    id="signup-password" 
                    class="input" 
                    placeholder="At least 6 characters"
                    required
                    minlength="6"
                    autocomplete="new-password"
                >
            </div>
            <div class="auth-form__error" id="signup-error" hidden></div>
            <button type="submit" class="btn btn--primary btn--lg w-full mt-4">
                Create Account
            </button>
            <p class="auth-form__footer">
                Already have an account? <button type="button" class="link" data-switch-to-signin>Sign in</button>
            </p>
        </form>
    `;

    const modal = Modal.open({
        title: 'Create Your Account',
        content,
        size: ''
    });

    const form = modal.querySelector('#signup-form');
    const errorEl = modal.querySelector('#signup-error');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.hidden = true;

        const name = form.querySelector('#signup-name').value;
        const email = form.querySelector('#signup-email').value;
        const password = form.querySelector('#signup-password').value;

        try {
            const submitBtn = form.querySelector('[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner spinner--sm"></span> Creating account...';

            await signUp({ name, email, password });
            Modal.close(modal);
            Toast.success('Account created!', 'Welcome to TaskFlow');
            
            // Refresh page to update UI
            window.location.reload();
        } catch (error) {
            errorEl.textContent = error.message;
            errorEl.hidden = false;
            const submitBtn = form.querySelector('[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Account';
        }
    });

    modal.querySelector('[data-switch-to-signin]')?.addEventListener('click', () => {
        Modal.close(modal);
        openSignInModal();
    });
}

/**
 * Gets user initials for avatar
 * @returns {string}
 */
export function getUserInitials() {
    if (!currentUser) return 'U';
    return getInitials(currentUser.name || currentUser.email);
}

/**
 * Opens profile editor (name, email, optional password change).
 */
export function openProfileModal() {
    const user = getCurrentUser();
    if (!user) {
        Toast.info('Profile', 'Sign in to edit your profile');
        return;
    }

    const content = `
        <form id="profile-form" class="auth-form">
            <div class="form-group">
                <label class="label label--required" for="profile-name">Full name</label>
                <input type="text" id="profile-name" class="input" required autocomplete="name"
                    value="${escapeHtml(user.name || '')}">
            </div>
            <div class="form-group">
                <label class="label label--required" for="profile-email">Email</label>
                <input type="email" id="profile-email" class="input" required autocomplete="email"
                    value="${escapeHtml(user.email || '')}">
            </div>
            <p class="text-sm text-tertiary mt-4">Change password (optional)</p>
            <div class="form-group">
                <label class="label" for="profile-current-password">Current password</label>
                <input type="password" id="profile-current-password" class="input"
                    autocomplete="current-password" placeholder="Required only if changing password">
            </div>
            <div class="form-group">
                <label class="label" for="profile-new-password">New password</label>
                <input type="password" id="profile-new-password" class="input" minlength="6"
                    autocomplete="new-password" placeholder="Min. 6 characters">
            </div>
            <div class="auth-form__error" id="profile-error" hidden></div>
            <button type="submit" class="btn btn--primary btn--lg w-full mt-4">Save profile</button>
        </form>
    `;

    const modal = Modal.open({
        title: 'Your profile',
        content,
        size: ''
    });

    const form = modal.querySelector('#profile-form');
    const errorEl = modal.querySelector('#profile-error');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        errorEl.hidden = true;

        const nameVal = form.querySelector('#profile-name').value;
        const emailVal = form.querySelector('#profile-email').value;
        const currentPassword = form.querySelector('#profile-current-password').value;
        const newPassword = form.querySelector('#profile-new-password').value;

        try {
            const submitBtn = form.querySelector('[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner spinner--sm"></span> Saving...';

            await updateProfile({
                name: nameVal,
                email: emailVal,
                currentPassword,
                newPassword: newPassword || undefined
            });

            Modal.close(modal);
            Toast.success('Profile saved', 'Your details have been updated');
            window.location.reload();
        } catch (err) {
            errorEl.textContent = err.message;
            errorEl.hidden = false;
            const submitBtn = form.querySelector('[type="submit"]');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Save profile';
        }
    });

    const body = modal.querySelector('.modal__body');
    if (body) {
        const rights = document.createElement('div');
        rights.className = 'mt-6 pt-4';
        rights.style.borderTop = '1px solid var(--color-border)';
        rights.innerHTML = `
            <p class="text-xs font-semibold text-tertiary mb-2 uppercase tracking-wide">Your data rights</p>
            <p class="text-sm text-secondary mb-3">
                Deletes every TaskFlow record in this browser (tasks, workspaces, preferences, sessions, demo accounts).
            </p>
            <button type="button" class="btn btn--danger btn--sm w-full" data-erase-local>Delete all local TaskFlow data</button>
        `;
        body.appendChild(rights);
        rights.querySelector('[data-erase-local]')?.addEventListener('click', async () => {
            const ok = await Modal.confirm({
                title: 'Delete all local data?',
                message: 'This cannot be undone. Use export from the profile menu first if you need a copy.',
                confirmText: 'Delete everything',
                danger: true
            });
            if (!ok) return;
            await eraseAllLocalWorkspaceDataAndSignOut();
            Modal.close(modal);
            Toast.success('Data removed', 'TaskFlow storage on this device was cleared');
            window.location.reload();
        });
    }
}
