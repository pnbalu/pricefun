import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

export function ChatsScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    const load = async () => {
      const { data: session } = await supabase.auth.getSession();
      const userId = session.session?.user.id;
      if (!userId) return;
      const { data } = await supabase
        .from('chats_view')
        .select('*')
        .order('updated_at', { ascending: false });
      setRows(data ?? []);
    };
    load();

    const channel = supabase
      .channel('chats-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        load();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_participants' }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity onPress={() => navigation.navigate('Menu')}>
          <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 18 }}>☰</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme.primary]);

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={rows}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.row}
          onPress={() => navigation.navigate('Chat', { chatId: item.id, title: item.title })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={styles.title}>{item.title}</Text>
            {!!item.unread_count && item.unread_count > 0 && (
              <View style={styles.badge}><Text style={styles.badgeText}>{item.unread_count}</Text></View>
            )}
          </View>
          {!!item.last_message && <Text style={styles.subtitle} numberOfLines={1}>{item.last_message}</Text>}
        </TouchableOpacity>
      )}
      ListEmptyComponent={() => (
        <View style={styles.empty}><Text>No chats yet.</Text></View>
      )}
      ListHeaderComponent={() => (
        <TouchableOpacity style={styles.newChat} onPress={() => navigation.navigate('NewChat')}>
          <Text style={styles.newChatText}>+ New chat</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  row: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { color: '#6b7280', marginTop: 4 },
  empty: { padding: 24, alignItems: 'center' },
  newChat: { paddingVertical: 10 },
  newChatText: { color: '#2563eb', fontWeight: '600' },
  badge: { backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, minWidth: 20, alignItems: 'center' },
  badgeText: { color: 'white', fontWeight: '700' },
});


