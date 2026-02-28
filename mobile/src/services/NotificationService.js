import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { firebaseConfig } from '../config/firebase';

// Configure notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

/**
 * Register for push notifications and get Expo push token
 * @returns {Promise<string|null>} Push token or null if failed
 */
export async function registerForPushNotifications() {
    let token = null;

    if (!Device.isDevice) {
        console.log('Must use physical device for Push Notifications');
        return null;
    }

    try {
        // Check existing permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        // Request permissions if not granted
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Failed to get push token: Permission denied');
            return null;
        }

        // Try to get token, but handle failure gracefully (e.g. Expo Go on Android)
        try {
            const tokenData = await Notifications.getExpoPushTokenAsync();
            token = tokenData.data;
            console.log('Expo Push Token:', token);
        } catch (tokenError) {
            console.warn('Failed to get push token. Note: Remote notifications are not supported in Expo Go on Android SDK 53+. Use local notifications or a development build.', tokenError);
            return null;
        }

        // Configure Android notification channel
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('medication', {
                name: 'Medication Reminders',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#4834d4',
                sound: 'default',
            });
        }

        return token;
    } catch (error) {
        console.error('Error getting push token:', error);
        return null;
    }
}

/**
 * Send push token to backend/Firebase
 * @param {string} uid - User ID
 * @param {string} token - Expo push token
 */
export async function sendTokenToBackend(uid, token) {
    try {
        await fetch(
            `${firebaseConfig.databaseURL}/users/${uid}.json`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pushToken: token,
                    tokenUpdatedAt: new Date().toISOString()
                })
            }
        );
        console.log('Push token saved to Firebase');
    } catch (error) {
        console.error('Error saving token:', error);
    }
}

/**
 * Setup notification listeners for foreground and background
 */
export function setupNotificationListeners() {
    // Handle notification received while app is in foreground
    const foregroundSubscription = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received in foreground:', notification);
    });

    // Handle notification tap
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification tapped:', response);
        const data = response.notification.request.content.data;

        // Handle navigation based on notification type
        if (data.type === 'medication_due') {
            // Navigate to medicine list
            console.log('Navigate to medicine list');
        } else if (data.type === 'medication_missed') {
            // Navigate to alerts
            console.log('Navigate to alerts');
        } else if (data.type === 'medicine_dispensed') {
            // Show confirmation
            console.log('Medicine dispensed confirmation');
        }
    });

    return () => {
        foregroundSubscription.remove();
        responseSubscription.remove();
    };
}

/**
 * Send a local notification (doesn't require backend)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data
 */
export async function sendLocalNotification(title, body, data = {}) {
    try {
        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
                sound: 'default',
                priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger: null, // Show immediately
        });
    } catch (error) {
        console.error('Error sending local notification:', error);
    }
}

/**
 * Schedule a local notification for a specific time
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Date} triggerDate - When to trigger notification
 * @param {string} identifier - Unique identifier for notification
 * @param {object} data - Additional data
 */
export async function scheduleNotification(title, body, triggerDate, identifier, data = {}) {
    try {
        const trigger = {
            date: triggerDate,
        };

        await Notifications.scheduleNotificationAsync({
            content: {
                title,
                body,
                data,
                sound: 'default',
                priority: Notifications.AndroidNotificationPriority.HIGH,
            },
            trigger,
            identifier,
        });

        console.log(`Scheduled notification: ${identifier}`);
    } catch (error) {
        console.error('Error scheduling notification:', error);
    }
}

/**
 * Cancel a scheduled notification
 * @param {string} identifier - Notification identifier
 */
export async function cancelNotification(identifier) {
    try {
        await Notifications.cancelScheduledNotificationAsync(identifier);
        console.log(`Cancelled notification: ${identifier}`);
    } catch (error) {
        console.error('Error cancelling notification:', error);
    }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
    try {
        await Notifications.cancelAllScheduledNotificationsAsync();
        console.log('Cancelled all notifications');
    } catch (error) {
        console.error('Error cancelling notifications:', error);
    }
}
