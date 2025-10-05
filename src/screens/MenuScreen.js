import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useTheme, themes } from '../context/ThemeContext';

export function MenuScreen() {
  const navigation = useNavigation();
  const { theme, currentTheme, changeTheme, availableThemes } = useTheme();

  const logout = async () => {
    Alert.alert('Logout', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.text }]}>Menu</Text>
      
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Navigation</Text>
        <TouchableOpacity style={[styles.item, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('Users')}>
          <Text style={[styles.itemText, { color: theme.text }]}>Users</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.item, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('Chats')}>
          <Text style={[styles.itemText, { color: theme.text }]}>Chats</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.item, { borderBottomColor: theme.border }]} onPress={() => navigation.navigate('Profile')}>
          <Text style={[styles.itemText, { color: theme.text }]}>Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Theme</Text>
        {availableThemes.map((themeOption) => (
          <TouchableOpacity
            key={themeOption.key}
            style={[
              styles.themeItem,
              { borderBottomColor: theme.border },
              currentTheme === themeOption.key && { backgroundColor: theme.surface }
            ]}
            onPress={() => changeTheme(themeOption.key)}
          >
            <View style={styles.themeRow}>
              <View style={[styles.themeColor, { backgroundColor: themes[themeOption.key].primary }]} />
              <Text style={[styles.itemText, { color: theme.text }]}>{themeOption.name}</Text>
              {currentTheme === themeOption.key && (
                <Text style={[styles.checkmark, { color: theme.primary }]}>✓</Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.spacer} />
      
      <TouchableOpacity style={[styles.logoutButton, { backgroundColor: theme.error }]} onPress={logout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  item: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  themeItem: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  itemText: { fontSize: 16 },
  themeRow: { flexDirection: 'row', alignItems: 'center' },
  themeColor: { width: 20, height: 20, borderRadius: 10, marginRight: 12 },
  checkmark: { marginLeft: 'auto', fontSize: 18, fontWeight: 'bold' },
  spacer: { flex: 1 },
  logoutButton: { padding: 16, borderRadius: 8, marginTop: 20 },
  logoutText: { color: 'white', fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
