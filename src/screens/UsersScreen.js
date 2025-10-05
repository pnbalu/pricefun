import { useEffect, useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, Text, Image } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

export function UsersScreen({ navigation }) {
  const { theme } = useTheme();
  const [rows, setRows] = useState([]);

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get all profiles - handle case where new fields might not exist yet
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, phone, display_name, about, profile_photo_url')
        .neq('id', user.id) // Exclude current user
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching profiles:', error);
        return;
      }

      // For each profile, get unread count from direct chats
      const profilesWithUnread = await Promise.all(
        (profiles || []).map(async (profile) => {
          try {
            const { data: chatData } = await supabase
              .from('chats_view')
              .select('unread_count')
              .eq('title', profile.display_name || profile.phone)
              .single();

            return {
              ...profile,
              unread_count: chatData?.unread_count || 0,
            };
          } catch (err) {
            return {
              ...profile,
              unread_count: 0,
            };
          }
        })
      );

      setRows(profilesWithUnread);
    } catch (error) {
      console.error('Error in load function:', error);
    }
  }, []);

  useEffect(() => {
    load();
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Menu')}>
          <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 18 }}>☰</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity onPress={() => navigation.navigate('NewChat')}>
          <Text style={{ color: theme.primary, fontWeight: '700' }}>Add</Text>
        </TouchableOpacity>
      ),
    });

    // Subscribe to realtime updates for unread counts
    const channel = supabase
      .channel('users-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        console.log('Message change detected:', payload);
        load();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_participants' }, (payload) => {
        console.log('Participant change detected:', payload);
        load();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_participants' }, (payload) => {
        console.log('New participant detected:', payload);
        load();
      })
      .subscribe((status) => {
        console.log('Users channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [theme.primary, navigation, load]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const startChat = async (phone) => {
    const { data, error } = await supabase.rpc('get_or_create_direct_chat_by_phone', { target_phone: phone });
    if (error) return;
    navigation.navigate('Chat', { chatId: data, title: phone });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <FlatList
        contentContainerStyle={styles.list}
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.userCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity onPress={() => startChat(item.phone)} style={styles.cardContent}>
              <View style={styles.userInfo}>
                {item.profile_photo_url ? (
                  <Image 
                    source={{ uri: item.profile_photo_url }}
                    style={[styles.avatar, { backgroundColor: theme.primary }]}
                  />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                    <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
                      {(item.display_name || item.phone).charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.userDetails}>
                  <Text style={[styles.title, { color: theme.text }]}>
                    {item.display_name || item.phone}
                  </Text>
                  <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                    {item.phone}
                  </Text>
                  {item.about && (
                    <Text style={[styles.about, { color: theme.textSecondary }]} numberOfLines={2}>
                      {item.about}
                    </Text>
                  )}
                </View>
              </View>
              {!!item.unread_count && item.unread_count > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.error }]}>
                  <Text style={styles.badgeText}>{item.unread_count}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.empty}><Text style={{ color: theme.textSecondary }}>No users yet.</Text></View>
        )}
      />
      
      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <View style={styles.footerContent}>
          <TouchableOpacity 
            style={[styles.footerIconButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('NewChat')}
          >
            <Text style={[styles.footerIconText, { color: 'white' }]}>➕</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.footerIconButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={[styles.footerIconText, { color: 'white' }]}>👤</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.footerIconButton, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate('Menu')}
          >
            <Text style={[styles.footerIconText, { color: 'white' }]}>⚙️</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 12 },
  userCard: {
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    padding: 16,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  about: {
    fontSize: 14,
    marginTop: 4,
    fontStyle: 'italic',
  },
  empty: { 
    padding: 24, 
    alignItems: 'center' 
  },
  badge: { 
    backgroundColor: '#ef4444', 
    paddingHorizontal: 8, 
    paddingVertical: 2, 
    borderRadius: 9999, 
    minWidth: 20, 
    alignItems: 'center',
    position: 'absolute',
    top: 8,
    right: 8,
  },
  badgeText: { 
    color: 'white', 
    fontWeight: '700', 
    fontSize: 12 
  },
  footer: {
    borderTopWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  footerIconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  footerIconText: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
});


