import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { AppNavigator } from './src/navigation';
import { ThemeProvider } from './src/context/ThemeContext';
import { NotificationService } from './src/services/notificationService';
import { useEffect } from 'react';

export default function App() {
  useEffect(() => {
    const setupNotifications = async () => {
      console.log('🔔 Setting up notifications...');
      
      try {
        // Request notification permissions
        const hasPermission = await NotificationService.requestPermissions();
        
        if (hasPermission) {
          // Get and log the push token (or local notifications status)
          const token = await NotificationService.getExpoPushToken();
          console.log('✅ Notifications setup complete:', token);
        } else {
          console.log('❌ Notifications setup failed - permissions not granted');
        }
      } catch (error) {
        console.error('❌ Error setting up notifications:', error);
      }
    };

    setupNotifications();
  }, []);

  return (
    <ThemeProvider>
      <View style={styles.container}>
        <AppNavigator />
        <StatusBar style="auto" />
      </View>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});


