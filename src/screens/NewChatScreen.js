import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { supabase } from '../lib/supabase';

export function NewChatScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const start = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_or_create_direct_chat_by_phone', { target_phone: phone });
      if (error) throw error;
      const chatId = data;
      navigation.navigate('Chat', { chatId, title: phone });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Phone number to chat with (E.164)"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />
      <TouchableOpacity style={styles.button} onPress={start} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Starting…' : 'Start chat'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#10b981', padding: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '600' },
});


