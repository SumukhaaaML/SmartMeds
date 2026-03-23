import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const QUOTES = [
    {
        text: "Every pill is a step toward a healthier you. Stay consistent!",
        author: "SmartMeds",
        icon: "💊",
        gradient: ['#667eea', '#764ba2'],
    },
    {
        text: "Taking care of yourself is the most powerful thing you can do.",
        author: "Anonymous",
        icon: "🌟",
        gradient: ['#f093fb', '#f5576c'],
    },
    {
        text: "Small daily habits lead to big health transformations.",
        author: "SmartMeds",
        icon: "🌱",
        gradient: ['#4facfe', '#00f2fe'],
    },
    {
        text: "Your health is your greatest wealth. Protect it every day.",
        author: "Anonymous",
        icon: "❤️",
        gradient: ['#43e97b', '#38f9d7'],
    },
    {
        text: "Be patient with yourself. Healing takes time — and that's okay.",
        author: "SmartMeds",
        icon: "🕊️",
        gradient: ['#fa709a', '#fee140'],
    },
    {
        text: "You showed up today. That already makes you a champion.",
        author: "Anonymous",
        icon: "🏆",
        gradient: ['#a18cd1', '#fbc2eb'],
    },
    {
        text: "Consistency is the secret ingredient to feeling your best.",
        author: "SmartMeds",
        icon: "🔥",
        gradient: ['#fd7043', '#ff8a65'],
    },
    {
        text: "Your body is working hard for you. Give it the medicine it needs.",
        author: "SmartMeds",
        icon: "🤝",
        gradient: ['#00b09b', '#96c93d'],
    },
    {
        text: "One moment at a time. One dose at a time. You've got this.",
        author: "Anonymous",
        icon: "⏰",
        gradient: ['#3a1c71', '#d76d77', '#ffaf7b'],
    },
    {
        text: "The best project you'll ever work on is yourself.",
        author: "Anonymous",
        icon: "✨",
        gradient: ['#11998e', '#38ef7d'],
    },
    {
        text: "A healthy routine is an act of self-love. Keep going.",
        author: "SmartMeds",
        icon: "💙",
        gradient: ['#2193b0', '#6dd5ed'],
    },
    {
        text: "Progress, not perfection. Each day is a new chance to do good.",
        author: "Anonymous",
        icon: "🚀",
        gradient: ['#8360c3', '#2ebf91'],
    },
];

export default function MotivationalQuote({ username }) {
    // Pick a random quote once on mount (stable per login session)
    const quote = useMemo(() => {
        return QUOTES[Math.floor(Math.random() * QUOTES.length)];
    }, []);

    const firstName = username?.split('@')[0] || 'there';

    return (
        <View style={{ marginBottom: 24 }}>
            <LinearGradient
                colors={quote.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.card}
            >
                {/* Top row */}
                <View style={styles.topRow}>
                    <View style={styles.iconCircle}>
                        <Text style={styles.icon}>{quote.icon}</Text>
                    </View>
                    <Text style={styles.greeting}>Good day, {firstName}!</Text>
                </View>

                {/* Quote */}
                <Text style={styles.quoteText}>"{quote.text}"</Text>

                {/* Author */}
                <View style={styles.divider} />
                <Text style={styles.author}>— {quote.author}</Text>
            </LinearGradient>
        </View>
    );
}

const styles = {
    card: {
        borderRadius: 28,
        padding: 28,
        shadowColor: '#667eea',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.35,
        shadowRadius: 24,
        elevation: 14,
    },
    topRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 20,
    },
    iconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: 'rgba(255,255,255,0.22)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.35)',
    },
    icon: {
        fontSize: 26,
    },
    greeting: {
        fontSize: 18,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.95)',
        letterSpacing: 0.3,
    },
    quoteText: {
        fontSize: 17,
        color: '#ffffff',
        fontWeight: '600',
        lineHeight: 28,
        fontStyle: 'italic',
        letterSpacing: 0.2,
    },
    divider: {
        height: 1,
        backgroundColor: 'rgba(255,255,255,0.3)',
        marginVertical: 16,
    },
    author: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '700',
        letterSpacing: 0.5,
        textAlign: 'right',
    },
};
