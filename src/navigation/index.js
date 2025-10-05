import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { AuthScreen } from '../screens/AuthScreen';
import { ChatsScreen } from '../screens/ChatsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { NewChatScreen } from '../screens/NewChatScreen';
import { UsersScreen } from '../screens/UsersScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { MenuScreen } from '../screens/MenuScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator();

export function AppNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const [needsProfile, setNeedsProfile] = useState(false);

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
  }, []);

  if (isAuthenticated === null) return null;

  return (
    <NavigationContainer theme={DefaultTheme}>
      <Stack.Navigator initialRouteName={isAuthenticated ? (needsProfile ? 'Register' : 'Users') : 'Auth'}>
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


