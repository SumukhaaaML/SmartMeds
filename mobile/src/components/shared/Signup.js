import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, ScrollView, Platform, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, rtdb } from '../../config/firebase';
import { ref, set } from 'firebase/database';
import { authStyles } from './styles/auth.styles';

export default function Signup({ onSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [userType, setUserType] = useState('patient'); // 'patient' or 'caregiver'
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSignUp() {
        setError('');
        if (!email || !password || !confirmPassword) {
            setError('Please fill all fields');
            return;
        }
        if (!/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
            setError('Enter a valid email');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }
        setLoading(true);
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            const uid = user.uid;

            // Store user type in Firebase Realtime Database using SDK
            await set(ref(rtdb, `users/${uid}`), {
                email,
                userType,
                createdAt: new Date().toISOString()
            });

            // Initialize caregiver patients list if caregiver
            if (userType === 'caregiver') {
                await set(ref(rtdb, `caregivers/${uid}/patients`), {});
            }

        } catch (err) {
            console.error('Sign up error', err);
            let msg = 'Sign up failed';
            if (err.code === 'auth/email-already-in-use') msg = 'Email already in use';
            if (err.code === 'auth/invalid-email') msg = 'Invalid email';
            if (err.code === 'auth/weak-password') msg = 'Password is too weak';
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
                                width: 80,
                                height: 80,
                                borderRadius: 40,
                                backgroundColor: 'rgba(255,255,255,0.2)',
                                justifyContent: 'center',
                                alignItems: 'center',
                                marginBottom: 16,
                                borderWidth: 1,
                                borderColor: 'rgba(255,255,255,0.4)'
                            }}>
                                <Ionicons name="person-add" size={40} color="#fff" />
                            </View>
                            <Text style={authStyles.appTitle}>Create Account</Text>
                            <Text style={authStyles.subtitle}>Join SmartMeds</Text>
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

                        <View style={authStyles.inputContainer}>
                            <Ionicons name="lock-closed-outline" size={20} color="#e0e0e0" style={authStyles.inputIcon} />
                            <TextInput
                                style={authStyles.authInput}
                                placeholder="Confirm Password"
                                placeholderTextColor="#ccc"
                                secureTextEntry
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                            />
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginBottom: 20 }}>
                            <TouchableOpacity
                                onPress={() => setUserType('patient')}
                                style={{
                                    backgroundColor: userType === 'patient' ? '#fff' : 'rgba(255,255,255,0.2)',
                                    paddingVertical: 10,
                                    paddingHorizontal: 24,
                                    borderTopLeftRadius: 20,
                                    borderBottomLeftRadius: 20,
                                }}
                            >
                                <Text style={{ color: userType === 'patient' ? '#333' : '#eee', fontWeight: 'bold' }}>Patient</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setUserType('caregiver')}
                                style={{
                                    backgroundColor: userType === 'caregiver' ? '#fff' : 'rgba(255,255,255,0.2)',
                                    paddingVertical: 10,
                                    paddingHorizontal: 24,
                                    borderTopRightRadius: 20,
                                    borderBottomRightRadius: 20,
                                }}
                            >
                                <Text style={{ color: userType === 'caregiver' ? '#333' : '#eee', fontWeight: 'bold' }}>Caregiver</Text>
                            </TouchableOpacity>
                        </View>

                        {error ? (
                            <View style={authStyles.errorContainer}>
                                <Ionicons name="alert-circle" size={16} color="#ff6b6b" />
                                <Text style={authStyles.errorText}>{error}</Text>
                            </View>
                        ) : null}

                        <TouchableOpacity
                            style={authStyles.primaryBtn}
                            onPress={handleSignUp}
                            disabled={loading}
                        >
                            <LinearGradient
                                colors={['#ffffff', '#e6e6e6']}
                                style={{ width: '100%', alignItems: 'center', paddingVertical: 16 }}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#4834d4" />
                                ) : (
                                    <Text style={authStyles.primaryBtnText}>Sign Up</Text>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => onSuccess(null, 'login')}>
                            <Text style={authStyles.switchText}>
                                Already have an account? <Text style={{ fontWeight: '800', textDecorationLine: 'underline' }}>Sign In</Text>
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </LinearGradient>
    );
}
