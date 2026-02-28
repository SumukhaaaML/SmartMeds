import { StyleSheet } from 'react-native';

export const authStyles = StyleSheet.create({
    container: { flex: 1 },
    keyboardView: { flex: 1 },
    authScroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
    glassCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        borderRadius: 24,
        padding: 28,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.25)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 24,
    },
    logoContainer: { alignItems: 'center', marginBottom: 32 },
    appTitle: { fontSize: 34, fontWeight: '800', color: '#fff', marginTop: 12, letterSpacing: 0.5 },
    subtitle: { fontSize: 16, color: 'rgba(255,255,255,0.85)', marginTop: 6, fontWeight: '500' },

    // User Type Selector
    userTypeContainer: { flexDirection: 'row', marginBottom: 24, gap: 14 },
    userTypeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.25)',
    },
    userTypeButtonActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        borderColor: 'rgba(255, 255, 255, 0.6)',
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    userTypeText: { fontSize: 14, color: '#fff', fontWeight: '700', marginLeft: 8, letterSpacing: 0.3 },

    // Input Fields
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
        borderRadius: 14,
        marginBottom: 18,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    inputIcon: { marginRight: 12 },
    authInput: { flex: 1, color: '#fff', paddingVertical: 18, fontSize: 16 },

    // Password Strength
    strengthContainer: {
        height: 5,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 3,
        marginBottom: 18,
        overflow: 'hidden'
    },
    strengthBar: { height: '100%', borderRadius: 3 },

    // Buttons
    primaryBtn: {
        marginTop: 12,
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10
    },
    primaryBtnText: {
        color: '#4834d4',
        fontSize: 18,
        fontWeight: '800',
        textAlign: 'center',
        paddingVertical: 18,
        backgroundColor: '#fff',
        letterSpacing: 0.5
    },
    switchText: {
        color: '#fff',
        textAlign: 'center',
        marginTop: 24,
        fontSize: 14,
        fontWeight: '600',
        letterSpacing: 0.2
    },

    // Error Messages
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18,
        backgroundColor: 'rgba(255, 107, 107, 0.25)',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 107, 107, 0.4)'
    },
    errorText: { color: '#ff6b6b', marginLeft: 8, fontSize: 14, fontWeight: '600' },
});
