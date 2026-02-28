import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform, StatusBar, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';
import { authStyles } from './styles/auth.styles';

export default function Login({ onSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Animation for error message
    const errorOpacity = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (error) {
            Animated.timing(errorOpacity, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(errorOpacity, {
                toValue: 0,
                duration: 200,
                useNativeDriver: true,
            }).start();
        }
    }, [error]);

    async function handleSignIn() {
        setError('');
        if (!email || !password) {
            setError('Please enter email and password');
            return;
        }
        setLoading(true);
        console.log('Login: Attempting sign in for', email);
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            console.log('Login: Success -', userCredential.user.email);
            // The onAuthStateChanged listener in App.js will handle the rest
        } catch (err) {
            console.error('Login: Sign in error', err);
            let msg = 'Sign in failed';
            if (err.code === 'auth/invalid-email') msg = 'Invalid email address';
            if (err.code === 'auth/user-not-found') msg = 'User not found';
            if (err.code === 'auth/wrong-password') msg = 'Incorrect password';
            if (err.code === 'auth/invalid-credential') msg = 'Invalid credentials';
            if (err.code === 'auth/too-many-requests') msg = 'Too many attempts. Try again later.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <LinearGradient colors={['#4c669f', '#3b5998', '#192f6a']} style={authStyles.container}>
            <StatusBar barStyle="light-content" />
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={authStyles.keyboardView}>
                <ScrollView contentContainerStyle={authStyles.authScroll}>
                    <View style={authStyles.glassCard}>
                        <View style={authStyles.logoContainer}>
                            <View style={{
                                width: 100,
                                height: 100,
                                borderRadius: 50,
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginBottom: 16,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.4)'
                            }}>
                                <Ionicons name="medical" size={60} color="#fff" />
                            </View>
                            <Text style={authStyles.appTitle}>SmartMeds</Text>
                            <Text style={authStyles.subtitle}>Voice-Powered Dispensing</Text>
                        </View>

                        <View style={authStyles.inputContainer}>
                            <Ionicons name="mail-outline" size={20} color="#e0e0e0" style={authStyles.inputIcon} />
                            <TextInput
                                style={authStyles.authInput}
                                placeholder="Email Address"
                                placeholderTextColor="#ccc"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={email}
                                onChangeText={setEmail}
                            />
                        </View>

                        <View style={authStyles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color="#e0e0e0" style={authStyles.inputIcon} />
                            <TextInput
                                style={authStyles.authInput}
                                placeholder="Password"
                                placeholderTextColor="#ccc"
                                secureTextEntry
                                value={password}
                                onChangeText={setPassword}
                            />
                        </View>

                        {/* Animated Error Container */}
                        <Animated.View style={[authStyles.errorContainer, { opacity: errorOpacity, display: error ? 'flex' : 'none' }]}>
                            <Ionicons name="alert-circle" size={20} color="#ff6b6b" />
                            <Text style={authStyles.errorText}>{error}</Text>
                        </Animated.View>

                        <TouchableOpacity
                            style={authStyles.primaryBtn}
                            onPress={handleSignIn}
                            disabled={loading}
                        >
                            <LinearGradient
                                colors={['#ffffff', '#e6e6e6']}
                                style={{ width: '100%', alignItems: 'center', paddingVertical: 16 }}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#4834d4" />
                                ) : (
                                    <Text style={authStyles.primaryBtnText}>Sign In</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => onSuccess(null, 'signup')}>
                            <Text style={authStyles.switchText}>
                                Don't have an account? <Text style={{ fontWeight: '800', textDecorationLine: 'underline' }}>Sign Up</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}
