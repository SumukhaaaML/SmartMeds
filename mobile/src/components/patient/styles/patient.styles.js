import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

export const patientStyles = StyleSheet.create({
    mainContainer: { flex: 1, backgroundColor: '#f0f2f5' },

    // Header
    headerBg: {
        paddingTop: 60,
        paddingBottom: 30,
        paddingHorizontal: 24,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 10,
        zIndex: 100
    },
    headerContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%'
    },
    greeting: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.9)',
        fontWeight: '600',
        letterSpacing: 0.5,
        marginBottom: 4
    },
    userEmail: {
        fontSize: 22,
        color: '#fff',
        fontWeight: '800',
        letterSpacing: 0.3
    },
    signOutBtn: {
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)'
    },

    dashboardContent: { padding: 20, paddingBottom: 100 },

    // Cards
    statusCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 8,
        marginBottom: 24,
    },
    glassCard: {
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.5)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.08,
        shadowRadius: 24,
        elevation: 8,
        marginBottom: 24,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1a1a1a',
        marginBottom: 20,
        letterSpacing: 0.5
    },

    // Audio Recorder
    recordSection: { alignItems: 'center', marginBottom: 30 },
    recordBtn: {
        width: 90,
        height: 90,
        borderRadius: 45,
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 15
    },
    recordBtnGradient: {
        width: '100%',
        height: '100%',
        borderRadius: 45,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: 'rgba(255,255,255,0.3)'
    },
    recordingActive: { transform: [{ scale: 1.1 }] },
    recordInstruction: {
        marginTop: 20,
        color: '#666',
        fontSize: 15,
        fontWeight: '600',
        letterSpacing: 0.3
    },
    transcriptBox: {
        backgroundColor: '#f8f9fa',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#e9ecef',
        marginTop: 20
    },
    transcriptLabel: { fontSize: 12, color: '#999', fontWeight: '800', marginBottom: 8, letterSpacing: 1, textTransform: 'uppercase' },
    transcriptText: { fontSize: 16, color: '#333', lineHeight: 24, fontWeight: '500' },

    // Detection Result
    detectionResult: {
        backgroundColor: '#f0f7ff',
        borderRadius: 18,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#cce5ff'
    },
    detectionRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)', paddingBottom: 12 },
    detectionLabel: { fontSize: 15, color: '#666', fontWeight: '600' },
    detectionValue: { fontSize: 16, color: '#2d3436', fontWeight: '800' },

    quickDispenseBtn: {
        borderRadius: 16,
        overflow: 'hidden',
        marginTop: 10,
        shadowColor: '#20bf6b',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 10
    },
    quickDispenseGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18
    },
    quickDispenseText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginRight: 10
    },

    // Medicine List
    medicinesList: { maxHeight: 500 },
    medicineCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f0f0f0'
    },
    medicineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    medicineName: { fontSize: 18, fontWeight: '800', color: '#2d3436', flex: 1, marginRight: 10 },

    slotBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e8f0fe',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#d2e3fc'
    },
    slotText: { color: '#1967d2', fontSize: 12, fontWeight: '700', marginLeft: 4 },

    medicineDosage: { fontSize: 14, color: '#636e72', marginBottom: 16, fontWeight: '500' },

    medicineBadges: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 16, gap: 8 },
    badge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3
    },
    badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },

    autoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e6fffa',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#b2f5ea'
    },
    autoBadgeText: { color: '#2c7a7b', fontSize: 11, fontWeight: '700', marginLeft: 4 },

    dispenseSmallBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f8f9fa',
        padding: 14,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#e9ecef'
    },
    dispenseSmallText: { color: '#4834d4', fontSize: 15, fontWeight: '700', marginRight: 8 },

    emptyState: { alignItems: 'center', padding: 60, opacity: 0.6 },
    emptyText: { color: '#999', fontSize: 16, marginTop: 16, fontWeight: '600' }
});
