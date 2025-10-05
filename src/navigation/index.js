import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { AuthScreen } from '../screens/AuthScreen';
import { ChatsScreen } from '../screens/ChatsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { NewChatScreen } from '../screens/NewChatScreen';
import { UsersScreen } from '../screens/UsersScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { CreateGroupScreen } from '../screens/CreateGroupScreen';
import { GroupInfoScreen } from '../screens/GroupInfoScreen';

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [needsProfile, setNeedsProfile] = useState(false);
  const { theme } = useTheme();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setIsAuthenticated(!!session);
      if (session) {
        const { data } = await supabase.from('profiles').select('id').eq('id', session.user.id).maybeSingle();
        setNeedsProfile(!data);
      } else {
        setNeedsProfile(false);
      }
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, [theme]);

  if (isAuthenticated === null) return null;

  // Create custom navigation theme that matches our app theme
  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: theme.primary,
      background: theme.surface,
      card: theme.surface,
      text: theme.text,
      border: theme.border,
      notification: theme.error,
    },
  };

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator 
        initialRouteName={isAuthenticated ? (needsProfile ? 'Register' : 'Users') : 'Auth'}
        screenOptions={{
          headerStyle: {
            backgroundColor: theme.surface,
            borderBottomColor: theme.border,
            borderBottomWidth: 1,
          },
          headerTintColor: theme.primary,
          headerTitleStyle: {
            color: theme.text,
          },
        }}
      >
        {isAuthenticated ? (
          <>
            {needsProfile ? (
              <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Register' }} />
            ) : (
              <>
                <Stack.Screen name="Users" component={UsersScreen} options={{ title: 'Users' }} />
                <Stack.Screen name="Chats" component={ChatsScreen} options={{ title: 'Chats' }} />
                <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
                <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
                <Stack.Screen name="NewChat" component={NewChatScreen} options={{ title: 'New chat' }} />
                <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: 'New Group' }} />
                <Stack.Screen name="GroupInfo" component={GroupInfoScreen} options={{ title: 'Group Info' }} />
                <Stack.Screen name="Menu" component={MenuScreen} options={{ title: 'Menu' }} />
              </>
            )}
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}


