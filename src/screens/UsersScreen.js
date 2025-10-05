import { useEffect, useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, Text, Image } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

export function UsersScreen({ navigation }) {
  const { theme } = useTheme();
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'groups', 'users'

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

      // Get all groups the user is part of
      const { data: groups, error: groupsError } = await supabase
        .from('chats')
        .select(`
          id,
          group_name,
          group_description,
          group_photo_url,
          created_at
        `)
        .eq('is_group', true)
        .order('created_at', { ascending: false });

      if (groupsError) {
        console.error('Error fetching groups:', groupsError);
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
              type: 'user'
            };
          } catch (err) {
            return {
              ...profile,
              unread_count: 0,
              type: 'user'
            };
          }
        })
      );

      // Format groups data and get unread counts
      const groupsWithUnread = await Promise.all(
        (groups || []).map(async (group) => {
          try {
            const { data: chatData } = await supabase
              .from('chats_view')
              .select('unread_count')
              .eq('id', group.id)
              .single();

            return {
              id: group.id,
              display_name: group.group_name || 'Group Chat',
              phone: null,
              about: group.group_description,
              profile_photo_url: group.group_photo_url,
              unread_count: chatData?.unread_count || 0,
              type: 'group',
              created_at: group.created_at
            };
          } catch (err) {
            return {
              id: group.id,
              display_name: group.group_name || 'Group Chat',
              phone: null,
              about: group.group_description,
              profile_photo_url: group.group_photo_url,
              unread_count: 0,
              type: 'group',
              created_at: group.created_at
            };
          }
        })
      );

      // Combine users and groups, sort by creation date
      const combinedRows = [...profilesWithUnread, ...groupsWithUnread]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      setRows(combinedRows);
    } catch (error) {
      console.error('Error in load function:', error);
    }
  }, []);

  useEffect(() => {
    load();
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity 
          onPress={() => navigation.navigate('Menu')} 
          style={{ 
            padding: 8, 
            justifyContent: 'center', 
            alignItems: 'center',
            minWidth: 44,
            minHeight: 44
          }}
        >
          <Ionicons name="menu" size={22} color={theme.primary} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity 
          onPress={() => navigation.navigate('NewChat')} 
          style={{ 
            padding: 8, 
            justifyContent: 'center', 
            alignItems: 'center',
            minWidth: 44,
            minHeight: 44
          }}
        >
          <Ionicons name="add" size={24} color={theme.primary} />
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

  // Filter rows based on active filter
  useEffect(() => {
    let filtered = rows;
    
    switch (activeFilter) {
      case 'groups':
        filtered = rows.filter(item => item.type === 'group');
        break;
      case 'users':
        filtered = rows.filter(item => item.type === 'user');
        break;
      case 'all':
      default:
        filtered = rows;
        break;
    }
    
    setFilteredRows(filtered);
  }, [rows, activeFilter]);

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
      {/* Filter Buttons */}
      <View style={[styles.filterContainer, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilter === 'all' && { backgroundColor: theme.primary }
          ]}
          onPress={() => setActiveFilter('all')}
        >
          <Text style={[
            styles.filterButtonText,
            { color: activeFilter === 'all' ? 'white' : theme.text }
          ]}>
            All
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilter === 'groups' && { backgroundColor: theme.primary }
          ]}
          onPress={() => setActiveFilter('groups')}
        >
          <Ionicons 
            name="people" 
            size={16} 
            color={activeFilter === 'groups' ? 'white' : theme.text} 
            style={{ marginRight: 4 }}
          />
          <Text style={[
            styles.filterButtonText,
            { color: activeFilter === 'groups' ? 'white' : theme.text }
          ]}>
            Groups
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[
            styles.filterButton,
            activeFilter === 'users' && { backgroundColor: theme.primary }
          ]}
          onPress={() => setActiveFilter('users')}
        >
          <Ionicons 
            name="person" 
            size={16} 
            color={activeFilter === 'users' ? 'white' : theme.text} 
            style={{ marginRight: 4 }}
          />
          <Text style={[
            styles.filterButtonText,
            { color: activeFilter === 'users' ? 'white' : theme.text }
          ]}>
            Users
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={filteredRows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.userCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <TouchableOpacity 
              onPress={() => item.type === 'group' ? navigation.navigate('Chat', { chatId: item.id }) : startChat(item.phone)} 
              style={styles.cardContent}
            >
              <View style={styles.userInfo}>
                {item.profile_photo_url ? (
                  <Image 
                    source={{ uri: item.profile_photo_url }}
                    style={[styles.avatar, { backgroundColor: theme.primary }]}
                  />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                    {item.type === 'group' ? (
                      <Ionicons name="people" size={24} color="white" />
                    ) : (
                      <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold' }}>
                        {(item.display_name || item.phone).charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                )}
                <View style={styles.userDetails}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.title, { color: theme.text }]}>
                      {item.display_name || item.phone}
                    </Text>
                    {item.type === 'group' && (
                      <View style={[styles.groupBadge, { backgroundColor: theme.primary + '20' }]}>
                        <Text style={[styles.groupBadgeText, { color: theme.primary }]}>Group</Text>
                      </View>
                    )}
                  </View>
                  {item.phone && (
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
                      {item.phone}
                    </Text>
                  )}
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
      
      {/* Bottom Tab Bar */}
      <View style={[styles.bottomTabBar, { backgroundColor: theme.surface, borderTopColor: theme.border }]}>
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => navigation.navigate('NewChat')}
        >
          <View style={[styles.tabIcon, { backgroundColor: theme.primary + '20' }]}>
            <Ionicons name="person-add" size={16} color={theme.primary} />
          </View>
          <Text style={[styles.tabLabel, { color: theme.textSecondary }]}>New Chat</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => navigation.navigate('CreateGroup')}
        >
          <View style={[styles.tabIcon, { backgroundColor: theme.primary + '20' }]}>
            <Ionicons name="people" size={16} color={theme.primary} />
          </View>
          <Text style={[styles.tabLabel, { color: theme.textSecondary }]}>New Group</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={[styles.tabIcon, { backgroundColor: theme.primary + '20' }]}>
            <Ionicons name="person" size={16} color={theme.primary} />
          </View>
          <Text style={[styles.tabLabel, { color: theme.textSecondary }]}>Profile</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.tabItem}
          onPress={() => navigation.navigate('Menu')}
        >
          <View style={[styles.tabIcon, { backgroundColor: theme.primary + '20' }]}>
            <Ionicons name="settings" size={16} color={theme.primary} />
          </View>
          <Text style={[styles.tabLabel, { color: theme.textSecondary }]}>Menu</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
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
  groupBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  groupBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
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
  bottomTabBar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingBottom: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  tabIconText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
});


