import { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Image, Animated, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

export function ProfileScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const [profile, setProfile] = useState({
    display_name: '',
    phone: '',
    about: '',
    profile_photo_url: null
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    loadProfile();
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity 
          onPress={() => navigation.navigate('Menu')}
          style={styles.headerButton}
        >
          <Text style={[styles.headerButtonText, { color: theme.primary }]}>☰</Text>
        </TouchableOpacity>
      ),
      headerRight: () => (
        <TouchableOpacity 
          onPress={toggleEditMode}
          style={styles.headerButton}
        >
          <Text style={[styles.headerButtonText, { color: theme.primary }]}>
            {isEditing ? '✕' : '✏️'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme.primary, isEditing]);

  const toggleEditMode = () => {
    setIsEditing(!isEditing);
    if (isEditing && hasChanges) {
      saveProfile();
    }
  };

  const handleInputChange = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, phone, about, profile_photo_url')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const pickImageFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload photos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfilePhoto(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking image from library:', error);
      Alert.alert('Error', 'Failed to pick image from library');
    }
  };

  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera permissions to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadProfilePhoto(result.assets[0]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const showPhotoOptions = () => {
    Alert.alert(
      'Select Photo',
      'Choose how you want to add your profile photo',
      [
        {
          text: 'Camera',
          onPress: takePhoto,
        },
        {
          text: 'Photo Library',
          onPress: pickImageFromLibrary,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const uploadProfilePhoto = async (asset) => {
    try {
      setUploading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Not signed in');
        return;
      }

      // Upload to Supabase Storage
      const fileName = `profile-${user.id}.jpg`;
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: 'image/jpeg',
        name: fileName,
      });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, formData, {
          contentType: 'image/jpeg',
          upsert: true, // Replace existing file
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      // Update profile with new photo URL
      setProfile(prev => ({ ...prev, profile_photo_url: publicUrl }));

    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload failed', error.message);
    } finally {
      setUploading(false);
    }
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not signed in');

      const { error } = await supabase
        .from('profiles')
        .upsert(
          { 
            id: user.id, 
            display_name: profile.display_name, 
            phone: profile.phone,
            about: profile.about,
            profile_photo_url: profile.profile_photo_url
          }, 
          { onConflict: 'id' }
        );

      if (error) throw error;
      
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Hero Section with Gradient */}
          <Animated.View 
            style={[
              styles.heroSection, 
              { 
                backgroundColor: theme.primary,
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }, { translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.heroContent}>
              <Text style={styles.heroSubtitle}>Manage your personal information</Text>
            </View>
          </Animated.View>

          {/* Profile Photo Card */}
          <Animated.View 
            style={[
              styles.card, 
              { 
                backgroundColor: theme.surface,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Profile Photo</Text>
              <View style={[styles.statusIndicator, { backgroundColor: profile.profile_photo_url ? '#4CAF50' : theme.textSecondary }]} />
            </View>
            
            <View style={styles.photoContainer}>
              <View style={styles.avatarWrapper}>
                {profile.profile_photo_url ? (
                  <Image 
                    source={{ uri: profile.profile_photo_url }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View style={[styles.profilePlaceholder, { backgroundColor: theme.primary }]}>
                    <Text style={styles.placeholderText}>
                      {profile.display_name?.charAt(0)?.toUpperCase() || profile.phone?.charAt(1) || 'U'}
                    </Text>
                  </View>
                )}
                
                <TouchableOpacity
                  onPress={showPhotoOptions}
                  disabled={uploading}
                  style={[styles.editPhotoButton, { backgroundColor: theme.primary }]}
                >
                  <Text style={styles.editPhotoIcon}>
                    {uploading ? '⏳' : '📷'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {uploading && (
                <View style={styles.uploadingIndicator}>
                  <Text style={[styles.uploadingText, { color: theme.primary }]}>
                    Uploading...
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>

          {/* Personal Information Card */}
          <Animated.View 
            style={[
              styles.card, 
              { 
                backgroundColor: theme.surface,
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <View style={styles.cardHeader}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Personal Information</Text>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Display Name</Text>
              <View style={[styles.inputWrapper, { borderColor: isEditing ? theme.primary : theme.border }]}>
                <TextInput
                  placeholder="Enter your display name"
                  placeholderTextColor={theme.textSecondary}
                  value={profile.display_name}
                  onChangeText={(text) => handleInputChange('display_name', text)}
                  editable={isEditing}
                  style={[styles.input, { color: theme.text }]}
                />
              </View>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Phone Number</Text>
              <View style={[styles.inputWrapper, styles.disabledInputWrapper, { borderColor: theme.border }]}>
                <TextInput
                  value={profile.phone}
                  editable={false}
                  style={[styles.input, { color: theme.textSecondary }]}
                />
                <View style={styles.lockIcon}>
                  <Text style={{ color: theme.textSecondary }}>🔒</Text>
                </View>
              </View>
              <Text style={[styles.inputHelper, { color: theme.textSecondary }]}>
                Phone number cannot be changed
              </Text>
            </View>
            
            <View style={styles.inputGroup}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>About</Text>
              <View style={[styles.inputWrapper, { borderColor: isEditing ? theme.primary : theme.border }]}>
                <TextInput
                  placeholder="Tell others about yourself..."
                  placeholderTextColor={theme.textSecondary}
                  value={profile.about}
                  onChangeText={(text) => handleInputChange('about', text)}
                  multiline
                  numberOfLines={4}
                  editable={isEditing}
                  style={[styles.input, styles.multilineInput, { color: theme.text }]}
                />
              </View>
              <Text style={[styles.inputHelper, { color: theme.textSecondary }]}>
                This will be visible to other users
              </Text>
            </View>
          </Animated.View>

          {/* Action Buttons */}
          {isEditing && (
            <Animated.View 
              style={[
                styles.actionSection,
                { 
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }]
                }
              ]}
            >
              <TouchableOpacity
                onPress={() => setIsEditing(false)}
                style={[styles.actionButton, styles.cancelButton, { borderColor: theme.border }]}
              >
                <Text style={[styles.actionButtonText, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={saveProfile}
                disabled={saving}
                style={[
                  styles.actionButton, 
                  styles.saveButton, 
                  { 
                    backgroundColor: saving ? theme.textSecondary : theme.primary,
                    opacity: saving ? 0.7 : 1
                  }
                ]}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? '⏳ Saving...' : '💾 Save Changes'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingBottom: 40,
    paddingTop: 0,
  },
  headerButton: {
    padding: 8,
    borderRadius: 8,
  },
  headerButtonText: {
    fontSize: 20,
    fontWeight: '600',
  },
  heroSection: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: 'white',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
    textAlign: 'center',
  },
  card: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  photoContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    alignItems: 'center',
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  profilePlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  placeholderText: {
    color: 'white',
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1,
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 3,
    borderColor: 'white',
  },
  editPhotoIcon: {
    fontSize: 18,
    color: 'white',
  },
  uploadingIndicator: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  uploadingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  inputWrapper: {
    borderWidth: 2,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.02)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  disabledInputWrapper: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontWeight: '500',
  },
  multilineInput: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  lockIcon: {
    marginLeft: 'auto',
  },
  inputHelper: {
    fontSize: 13,
    marginTop: 6,
    fontWeight: '500',
    opacity: 0.7,
  },
  actionSection: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 32,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelButton: {
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  saveButton: {
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
