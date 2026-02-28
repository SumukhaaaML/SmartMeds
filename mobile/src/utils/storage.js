import * as SecureStore from 'expo-secure-store';

// Check if SecureStore is available (not available on web)
const secureAvailable = SecureStore && typeof SecureStore.getItemAsync === 'function';

/**
 * Store authentication token securely
 * Uses SecureStore on native platforms, localStorage on web
 */
export async function storeToken(token) {
    if (secureAvailable) {
        return SecureStore.setItemAsync('authToken', token);
    } else if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.setItem('authToken', token);
    }
}

/**
 * Retrieve authentication token
 * Uses SecureStore on native platforms, localStorage on web
 */
export async function getToken() {
    if (secureAvailable) {
        return SecureStore.getItemAsync('authToken');
    } else if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem('authToken');
    }
    return null;
}

/**
 * Delete authentication token
 * Uses SecureStore on native platforms, localStorage on web
 */
export async function deleteToken() {
    if (secureAvailable) {
        return SecureStore.deleteItemAsync('authToken');
    } else if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.removeItem('authToken');
    }
}

/**
 * Store user data
 */
export async function storeUserData(userData) {
    const dataString = JSON.stringify(userData);
    if (secureAvailable) {
        return SecureStore.setItemAsync('userData', dataString);
    } else if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.setItem('userData', dataString);
    }
}

/**
 * Retrieve user data
 */
export async function getUserData() {
    let dataString = null;
    if (secureAvailable) {
        dataString = await SecureStore.getItemAsync('userData');
    } else if (typeof window !== 'undefined' && window.localStorage) {
        dataString = window.localStorage.getItem('userData');
    }
    return dataString ? JSON.parse(dataString) : null;
}

/**
 * Delete user data
 */
export async function deleteUserData() {
    if (secureAvailable) {
        return SecureStore.deleteItemAsync('userData');
    } else if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.removeItem('userData');
    }
}
