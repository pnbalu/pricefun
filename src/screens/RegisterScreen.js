import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

export function RegisterScreen({ navigation }) {
  const { theme } = useTheme();
  const [phone, setPhone] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: 'Complete registration' });
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.phone) setPhone(user.phone);
    });
  }, []);

  const save = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');
      const { error } = await supabase.from('profiles').upsert({ id: user.id, phone: phone || user.phone, display_name: displayName }, { onConflict: 'id' });
      if (error) throw error;
      navigation.reset({ index: 0, routes: [{ name: 'Users' }] });
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>
            Finish setting up your account
          </Text>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Phone Number</Text>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              style={[styles.input, { 
                color: theme.text, 
                borderColor: theme.border,
                backgroundColor: theme.background 
              }]}
              editable={false}
            />
          </View>
          
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: theme.text }]}>Display Name (Optional)</Text>
            <TextInput
              placeholder="Enter your display name"
              placeholderTextColor={theme.textSecondary}
              value={displayName}
              onChangeText={setDisplayName}
              style={[styles.input, { 
                color: theme.text, 
                borderColor: theme.border,
                backgroundColor: theme.background 
              }]}
            />
          </View>
          
          <TouchableOpacity
            onPress={save}
            disabled={saving}
            style={[
              styles.button, 
              { 
                backgroundColor: saving ? theme.textSecondary : theme.primary,
                opacity: saving ? 0.7 : 1
              }
            ]}
          >
            <Text style={styles.buttonText}>
              {saving ? 'Saving…' : 'Save Profile'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={logout}
            style={styles.logoutButton}
          >
            <Text style={[styles.logoutText, { color: theme.error }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  card: {
    marginHorizontal: 16,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    fontSize: 16,
    padding: 16,
    borderWidth: 2,
    borderRadius: 12,
    borderColor: '#e1e5e9',
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '500',
  },
});


