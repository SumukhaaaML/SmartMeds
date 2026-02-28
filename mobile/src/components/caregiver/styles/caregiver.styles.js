import { StyleSheet } from 'react-native';

export const caregiverStyles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#f0f2f5' },

    // Header
    headerBg: {
        paddingTop: 60,
        paddingBottom: 30,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15,
        shadowRadius: 15,
        elevation: 10,
        zIndex: 100
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%'
    },
    headerTitle: { fontSize: 28, color: '#fff', fontWeight: '800', letterSpacing: 0.5 },
    headerSubtitle: { fontSize: 15, color: 'rgba(255,255,255,0.85)', fontWeight: '600', marginTop: 4, letterSpacing: 0.3 },
    signOutBtn: {
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)'
    },

    dashboardContent: { padding: 20, paddingBottom: 100 },

    // Cards
    sectionCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 8,
        borderWidth: 1,
        borderColor: '#f0f0f0'
    },
    sectionTitle: { fontSize: 20, fontWeight: '800', color: '#1a1a1a', marginBottom: 20, letterSpacing: 0.5 },

    // Patient List
    addPatientForm: { marginBottom: 24 },
    inputRow: { flexDirection: 'row', gap: 12 },
    input: {
        flex: 1,
        backgroundColor: '#f8f9fa',
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 16,
        fontSize: 15,
        color: '#2d3436',
        borderWidth: 1,
        borderColor: '#e9ecef',
        marginBottom: 12
    },
    addButton: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: '#4834d4',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6
    },
    addButtonGradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center'
    },
    addButtonText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },

    patientItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 18,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f0f0f0'
    },
    patientItemActive: {
        backgroundColor: '#f0f4ff',
        borderColor: '#4834d4',
        borderWidth: 2,
        transform: [{ scale: 1.02 }]
    },
    patientInfo: { flex: 1 },
    patientName: { fontSize: 17, fontWeight: '800', color: '#2d3436', marginBottom: 4 },
    patientEmail: { fontSize: 13, color: '#636e72', fontWeight: '500' },

    removeButton: {
        backgroundColor: '#fff0f0',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#ffcdd2'
    },

    // Medicine Manager
    medicineItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 18,
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 14,
        borderLeftWidth: 4,
        borderLeftColor: '#4834d4',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2
    },
    medicineInfo: { flex: 1 },
    medicineName: { fontSize: 16, fontWeight: '800', color: '#2d3436', marginBottom: 4 },
    medicineDetails: { fontSize: 13, color: '#636e72', marginTop: 2, fontWeight: '500' },

    // Alerts
    alertItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 18,
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 14,
        borderLeftWidth: 4,
        borderLeftColor: '#ff9800',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 3
    },
    alertContent: { flex: 1 },
    alertPatient: { fontSize: 15, fontWeight: '800', color: '#2d3436', marginBottom: 4 },
    alertMessage: { fontSize: 13, color: '#636e72', marginBottom: 4 },
    alertTime: { fontSize: 11, color: '#999', fontWeight: '700' },

    dismissButton: {
        backgroundColor: '#e8f5e9',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#c8e6c9'
    },

    // Empty States
    emptyState: {
        alignItems: 'center',
        paddingVertical: 50,
        opacity: 0.7
    },
    emptyText: { fontSize: 15, color: '#999', marginTop: 16, fontWeight: '600' },

    // Messages
    errorMessage: {
        backgroundColor: '#ffebee',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#ef9a9a',
        flexDirection: 'row',
        alignItems: 'center'
    },
    errorText: { color: '#c62828', fontSize: 14, fontWeight: '600', marginLeft: 8 },

    successMessage: {
        backgroundColor: '#e8f5e9',
        padding: 16,
        borderRadius: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#a5d6a7',
        flexDirection: 'row',
        alignItems: 'center'
    },
    successText: { color: '#2e7d32', fontSize: 14, fontWeight: '600', marginLeft: 8 },
});
