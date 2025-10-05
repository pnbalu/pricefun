import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

export function AuthScreen() {
  const { theme } = useTheme();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [phase, setPhase] = useState('phone');
  const [loading, setLoading] = useState(false);

  const sendOtp = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      setPhase('otp');
      Alert.alert('OTP sent');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: 'sms' });
      if (error) throw error;
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('profiles').upsert({ id: user.id, phone }, { onConflict: 'id' });
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      Alert.alert('OTP resent');
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.title, { color: theme.text }]}>
            Sign in with phone
          </Text>
          
          {phase === 'phone' ? (
            <>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.text }]}>Phone Number</Text>
                <TextInput
                  placeholder="+15555550123"
                  placeholderTextColor={theme.textSecondary}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  style={[styles.input, { 
                    color: theme.text, 
                    borderColor: theme.border,
                    backgroundColor: theme.background 
                  }]}
                />
              </View>
              
              <TouchableOpacity
                onPress={sendOtp}
                disabled={loading}
                style={[
                  styles.button, 
                  { 
                    backgroundColor: loading ? theme.textSecondary : theme.primary,
                    opacity: loading ? 0.7 : 1
                  }
                ]}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Sending…' : 'Send Code'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <Text style={[styles.label, { color: theme.text }]}>Enter OTP</Text>
                <TextInput
                  placeholder="123456"
                  placeholderTextColor={theme.textSecondary}
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  style={[styles.input, { 
                    color: theme.text, 
                    borderColor: theme.border,
                    backgroundColor: theme.background 
                  }]}
                />
              </View>
              
              <TouchableOpacity
                onPress={verifyOtp}
                disabled={loading}
                style={[
                  styles.button, 
                  { 
                    backgroundColor: loading ? theme.textSecondary : theme.primary,
                    opacity: loading ? 0.7 : 1
                  }
                ]}
              >
                <Text style={styles.buttonText}>
                  {loading ? 'Verifying…' : 'Verify'}
                </Text>
              </TouchableOpacity>
              
              <View style={styles.linksRow}>
                <TouchableOpacity
                  onPress={resendOtp}
                  disabled={loading}
                  style={styles.linkButton}
                >
                  <Text style={[styles.linkText, { color: theme.primary }]}>
                    {loading ? 'Resending…' : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={() => setPhase('phone')}
                  disabled={loading}
                  style={styles.linkButton}
                >
                  <Text style={[styles.linkText, { color: theme.primary }]}>Back</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
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
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  linkButton: {
    padding: 8,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '500',
  },
});


