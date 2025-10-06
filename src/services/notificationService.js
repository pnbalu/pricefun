import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Set up Android notification channel
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });
}

export class NotificationService {
  static async requestPermissions() {
    try {
      if (!Device.isDevice) {
        console.log('Must use physical device for Push Notifications');
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        console.log('❌ Notification permissions not granted');
        return false;
      }
      
      console.log('✅ Notification permissions granted');
      return true;
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  static async getExpoPushToken() {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      // Check if we have a valid project ID
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      
      if (!projectId || projectId === 'your-project-id-here') {
        console.log('📱 Project ID not configured - using local notifications only');
        console.log('💡 To enable remote push notifications, configure your EAS project ID in app.json');
        return 'local-notifications-enabled';
      }

      // Try to get the Expo push token
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: projectId
      });
      
      console.log('📱 Expo Push Token:', token.data);
      return token.data;
    } catch (error) {
      console.error('Error getting push token:', error);
      console.log('📱 Falling back to local notifications only');
      return 'local-notifications-enabled';
    }
  }

  static async sendLocalNotification(title, body, data = {}) {
    try {
      console.log('📤 Sending notification:', { title, body, data });
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: 'default',
        },
        trigger: null, // Show immediately
      });
      
      console.log('✅ Notification sent successfully');
    } catch (error) {
      console.error('❌ Error sending local notification:', error);
    }
  }

  static async sendMessageNotification(senderName, messageContent, chatId, messageType = 'text') {
    let title = 'New Message';
    let body = messageContent;

    // Customize notification based on message type
    switch (messageType) {
      case 'image':
        body = `${senderName} sent a photo`;
        break;
      case 'voice':
        body = `${senderName} sent a voice message`;
        break;
      case 'video':
        body = `${senderName} sent a video`;
        break;
      default:
        // For text messages, show sender name and content
        if (messageContent.length > 50) {
          body = `${senderName}: ${messageContent.substring(0, 50)}...`;
        } else {
          body = `${senderName}: ${messageContent}`;
        }
        break;
    }

    await this.sendLocalNotification(title, body, {
      chatId,
      messageType,
      senderName,
    });
  }

  static async clearAllNotifications() {
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error('Error clearing notifications:', error);
    }
  }

  static async setBadgeCount(count) {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  // Test function to verify notifications are working
  static async testNotification() {
    try {
      console.log('🧪 Testing notification...');
      await this.sendLocalNotification(
        'Test Notification',
        'This is a test notification to verify the system is working!',
        { test: true }
      );
    } catch (error) {
      console.error('❌ Test notification failed:', error);
    }
  }
}
