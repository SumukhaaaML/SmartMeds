import { StyleSheet } from 'react-native';

export const caregiverStyles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#0f1015' },

    // Header
    headerBg: {
        paddingTop: 60,
        paddingBottom: 30,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 36,
        borderBottomRightRadius: 36,
        shadowColor: '#00f2fe',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 20,
        elevation: 15,
        zIndex: 100
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%'
    },
    headerTitle: { fontSize: 32, color: '#ffffff', fontWeight: '900', letterSpacing: 0.5 },
    headerSubtitle: { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '600', marginTop: 4, letterSpacing: 0.3 },
    signOutBtn: {
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)'
    },

    dashboardContent: { padding: 20, paddingBottom: 100 },

    // Cards
    sectionCard: {
        backgroundColor: '#1a1c23',
        borderRadius: 28,
        padding: 24,
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 25,
        elevation: 12,
        borderWidth: 1,
        borderColor: '#2a2d36'
    },
    sectionTitle: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 20, letterSpacing: 0.5 },

    // Forms / Inputs
    addPatientForm: { marginBottom: 24 },
    inputRow: { flexDirection: 'row', gap: 12 },
    input: {
        flex: 1,
        backgroundColor: '#22252e',
        borderRadius: 18,
        paddingHorizontal: 20,
        paddingVertical: 18,
        fontSize: 16,
        color: '#ffffff',
        borderWidth: 1,
        borderColor: '#343844',
        marginBottom: 16
    },
    
    // Add Button
    addButton: {
        borderRadius: 20,
        overflow: 'hidden',
        marginTop: 10,
        shadowColor: '#4facfe',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        elevation: 10
    },
    addButtonGradient: {
        paddingVertical: 20,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 8
    },
    addButtonText: { color: '#ffffff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },

    // Patient List
    patientItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#22252e',
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#343844'
    },
    patientItemActive: {
        backgroundColor: '#282d3f',
        borderColor: '#4facfe',
        borderWidth: 2,
        transform: [{ scale: 1.02 }],
        shadowColor: '#4facfe',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
    },
    patientInfo: { flex: 1 },
    patientName: { fontSize: 18, fontWeight: '800', color: '#ffffff', marginBottom: 6 },
    patientEmail: { fontSize: 14, color: '#a0aab2', fontWeight: '500' },

    removeButton: {
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 107, 107, 0.3)'
    },

    // Medicine Manager items
    medicineItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 18,
        backgroundColor: '#22252e',
        borderRadius: 18,
        marginBottom: 14,
        borderLeftWidth: 4,
        borderLeftColor: '#4facfe',
    },
    medicineInfo: { flex: 1 },
    medicineName: { fontSize: 17, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
    medicineDetails: { fontSize: 14, color: '#a0aab2', marginTop: 2, fontWeight: '500' },

    // Alerts
    alertItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 18,
        backgroundColor: '#22252e',
        borderRadius: 18,
        marginBottom: 14,
        borderLeftWidth: 4,
        borderLeftColor: '#f39c12',
    },
    alertContent: { flex: 1 },
    alertPatient: { fontSize: 16, fontWeight: '800', color: '#ffffff', marginBottom: 6 },
    alertMessage: { fontSize: 14, color: '#d1d8e0', marginBottom: 6 },
    alertTime: { fontSize: 12, color: '#7f8fa6', fontWeight: '700' },

    dismissButton: {
        backgroundColor: 'rgba(32, 191, 107, 0.1)',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(32, 191, 107, 0.3)'
    },

    // Empty States
    emptyState: {
        alignItems: 'center',
        paddingVertical: 50,
        opacity: 0.6
    },
    emptyText: { fontSize: 16, color: '#a0aab2', marginTop: 16, fontWeight: '600' },

    // Messages
    errorMessage: {
        backgroundColor: 'rgba(235, 77, 75, 0.15)',
        padding: 18,
        borderRadius: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(235, 77, 75, 0.4)',
        flexDirection: 'row',
        alignItems: 'center'
    },
    errorText: { color: '#ff7979', fontSize: 15, fontWeight: '600', marginLeft: 10 },

    successMessage: {
        backgroundColor: 'rgba(32, 191, 107, 0.15)',
        padding: 18,
        borderRadius: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(32, 191, 107, 0.4)',
        flexDirection: 'row',
        alignItems: 'center'
    },
    successText: { color: '#2ed573', fontSize: 15, fontWeight: '600', marginLeft: 10 },
});

