// Backend URL - Update this with your computer's IP address for physical devices
// For emulator/simulator, use 127.0.0.1 or localhost
export const BACKEND_URL = 'http://192.168.31.20:5000';

// API Endpoints
export const API_ENDPOINTS = {
    PROCESS_AUDIO: `${BACKEND_URL}/process_audio`,
    SEND_INSTRUCTION: `${BACKEND_URL}/send_instruction`,
    DISPENSE_BY_TIME: `${BACKEND_URL}/dispense_by_time`,
};

// Firebase Auth Endpoints
export const FIREBASE_AUTH_ENDPOINTS = {
    SIGN_IN: 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
    SIGN_UP: 'https://identitytoolkit.googleapis.com/v1/accounts:signUp',
};
