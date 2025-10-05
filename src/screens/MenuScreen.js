import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView, SafeAreaView, Image } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme, themes } from '../context/ThemeContext';
import { useEffect, useState } from 'react';

export function MenuScreen() {
  const navigation = useNavigation();
  const { theme, currentTheme, changeTheme, availableThemes } = useTheme();
  const [userProfile, setUserProfile] = useState(null);
  const [isThemesExpanded, setIsThemesExpanded] = useState(false);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('display_name, phone, profile_photo_url')
          .eq('id', user.id)
          .single();
        setUserProfile(profile || { display_name: '', phone: user.phone || '', profile_photo_url: null });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const logout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header Section */}
        <View style={[styles.headerSection, { backgroundColor: theme.primary }]}>
          <View style={styles.userInfo}>
            {userProfile?.profile_photo_url ? (
              <Image 
                source={{ uri: userProfile.profile_photo_url }}
                style={styles.profileImage}
              />
            ) : (
              <View style={[styles.profilePlaceholder, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                <Text style={styles.profileInitial}>
                  {(userProfile?.display_name || userProfile?.phone || 'U').charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.userDetails}>
              <Text style={styles.userName}>
                {userProfile?.display_name || userProfile?.phone || 'User'}
              </Text>
              <Text style={styles.userPhone}>
                {userProfile?.phone || 'No phone'}
              </Text>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.border }]} 
            onPress={() => navigation.navigate('Users')}
          >
            <View style={styles.menuItemContent}>
              <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="people" size={18} color={theme.primary} />
              </View>
              <Text style={[styles.menuText, { color: theme.text }]}>Users</Text>
              <Text style={[styles.menuArrow, { color: theme.textSecondary }]}>›</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.menuItem, { borderBottomColor: theme.border }]} 
            onPress={() => navigation.navigate('Profile')}
          >
            <View style={styles.menuItemContent}>
              <View style={[styles.iconContainer, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="person" size={18} color={theme.primary} />
              </View>
              <Text style={[styles.menuText, { color: theme.text }]}>Profile</Text>
              <Text style={[styles.menuArrow, { color: theme.textSecondary }]}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Theme Section - Accordion */}
        <View style={styles.menuSection}>
          <TouchableOpacity 
            style={styles.accordionHeader}
            onPress={() => setIsThemesExpanded(!isThemesExpanded)}
          >
            <View style={styles.accordionHeaderContent}>
              <Ionicons name="color-palette" size={20} color={theme.primary} />
              <Text style={[styles.accordionTitle, { color: theme.text }]}>Appearance</Text>
              <Text style={[styles.accordionArrow, { color: theme.textSecondary }]}>
                {isThemesExpanded ? '▼' : '▶'}
              </Text>
            </View>
          </TouchableOpacity>
          
          {isThemesExpanded && (
            <View style={styles.accordionContent}>
              {availableThemes.map((themeOption, index) => (
                <TouchableOpacity
                  key={themeOption.key}
                  style={[
                    styles.themeItem,
                    { borderBottomColor: theme.border },
                    index === availableThemes.length - 1 && { borderBottomWidth: 0 },
                    currentTheme === themeOption.key && { backgroundColor: theme.surface }
                  ]}
                  onPress={() => changeTheme(themeOption.key)}
                >
                  <View style={styles.menuItemContent}>
                    <View style={[styles.themeColorIndicator, { backgroundColor: themes[themeOption.key].primary }]} />
                    <Text style={[styles.menuText, { color: theme.text }]}>{themeOption.name}</Text>
                    {currentTheme === themeOption.key && (
                      <Text style={[styles.checkmark, { color: theme.primary }]}>✓</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />
      </ScrollView>

      {/* Logout Button */}
      <View style={styles.footerSection}>
        <TouchableOpacity 
          style={[styles.logoutButton, { backgroundColor: theme.error }]} 
          onPress={logout}
        >
          <View style={styles.logoutIconContainer}>
            <Ionicons name="log-out" size={16} color="white" />
          </View>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  headerSection: {
    paddingTop: 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  profilePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    color: 'white',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  userPhone: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
  },
  menuSection: {
    marginTop: 20,
    marginHorizontal: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  accordionHeader: {
    backgroundColor: '#f8f9fa',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e9ecef',
  },
  accordionHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  accordionIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  accordionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  accordionArrow: {
    fontSize: 16,
    fontWeight: '300',
  },
  accordionContent: {
    backgroundColor: 'white',
  },
  menuItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f3f4',
  },
  themeItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f1f3f4',
  },
  menuItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  iconText: {
    fontSize: 18,
    fontWeight: '600',
  },
  accordionIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 24,
    textAlign: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  menuArrow: {
    fontSize: 18,
    color: '#6c757d',
    fontWeight: '300',
  },
  themeColorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 16,
    borderWidth: 2,
    borderColor: '#e9ecef',
  },
  checkmark: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  spacer: {
    height: 40,
  },
  footerSection: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e9ecef',
    backgroundColor: 'white',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  logoutIcon: {
    fontSize: 16,
    fontWeight: '600',
  },
  logoutText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
