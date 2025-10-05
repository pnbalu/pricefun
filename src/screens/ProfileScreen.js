import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

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

  useEffect(() => {
    loadProfile();
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={[styles.headerCard, { backgroundColor: theme.primary }]}>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <Text style={styles.headerSubtitle}>Customize your profile information</Text>
          </View>

          {/* Profile Photo Section */}
          <View style={[styles.photoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Profile Photo</Text>
            <View style={styles.photoSection}>
              <View style={styles.avatarContainer}>
                {profile.profile_photo_url ? (
                  <Image 
                    source={{ uri: profile.profile_photo_url }}
                    style={styles.profileImage}
                  />
                ) : (
                  <View style={[styles.profilePlaceholder, { backgroundColor: theme.primary }]}>
                    <Text style={{ color: 'white', fontSize: 48, fontWeight: 'bold' }}>
                      {profile.display_name?.charAt(0)?.toUpperCase() || profile.phone?.charAt(1) || 'U'}
                    </Text>
                  </View>
                )}
                <TouchableOpacity
                  onPress={showPhotoOptions}
                  disabled={uploading}
                  style={[styles.cameraButton, { backgroundColor: theme.primary }]}
                >
                  <Text style={{ color: 'white', fontSize: 20 }}>📷</Text>
                </TouchableOpacity>
              </View>
              {uploading && (
                <View style={styles.uploadingContainer}>
                  <Text style={[styles.uploadingText, { color: theme.primary }]}>
                    ⏳ Uploading photo...
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Personal Information Section */}
          <View style={[styles.infoCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Personal Information</Text>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Display Name</Text>
              <TextInput
                placeholder="Enter your display name"
                placeholderTextColor={theme.textSecondary}
                value={profile.display_name}
                onChangeText={(text) => setProfile(prev => ({ ...prev, display_name: text }))}
                style={[styles.input, { 
                  color: theme.text, 
                  borderColor: theme.border,
                  backgroundColor: theme.background 
                }]}
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Phone Number</Text>
              <TextInput
                value={profile.phone}
                editable={false}
                style={[styles.input, styles.disabledInput, { 
                  color: theme.textSecondary, 
                  borderColor: theme.border,
                  backgroundColor: theme.background 
                }]}
              />
              <Text style={[styles.helpText, { color: theme.textSecondary }]}>
                Phone number cannot be changed
              </Text>
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: theme.text }]}>About</Text>
              <TextInput
                placeholder="Tell others about yourself..."
                placeholderTextColor={theme.textSecondary}
                value={profile.about}
                onChangeText={(text) => setProfile(prev => ({ ...prev, about: text }))}
                multiline
                numberOfLines={4}
                style={[styles.input, styles.textArea, { 
                  color: theme.text, 
                  borderColor: theme.border,
                  backgroundColor: theme.background 
                }]}
              />
              <Text style={[styles.helpText, { color: theme.textSecondary }]}>
                This will be visible to other users
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              onPress={saveProfile}
              disabled={saving}
              style={[
                styles.saveButton, 
                { 
                  backgroundColor: saving ? theme.textSecondary : theme.primary,
                  opacity: saving ? 0.7 : 1
                }
              ]}
            >
              <Text style={styles.saveButtonText}>
                {saving ? '⏳ Saving…' : '💾 Save Profile'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
    paddingBottom: 32,
  },
  headerCard: {
    marginBottom: 20,
    padding: 24,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
  photoCard: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  infoCard: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  photoSection: {
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  profileImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#f0f0f0',
  },
  profilePlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  cameraButton: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  uploadingContainer: {
    alignItems: 'center',
    padding: 8,
  },
  uploadingText: {
    fontSize: 14,
    fontWeight: '500',
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
  disabledInput: {
    opacity: 0.6,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  helpText: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  actionContainer: {
    marginTop: 20,
  },
  saveButton: {
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
