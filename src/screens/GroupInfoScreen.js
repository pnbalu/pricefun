import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  StyleSheet,
  SafeAreaView,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import * as ImagePicker from 'expo-image-picker';

export function GroupInfoScreen({ navigation, route }) {
  const { chatId } = route.params;
  const { theme } = useTheme();
  const [groupInfo, setGroupInfo] = useState(null);
  const [members, setMembers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState(new Set());
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editGroupName, setEditGroupName] = useState('');
  const [editGroupDescription, setEditGroupDescription] = useState('');

  useEffect(() => {
    loadGroupInfo();
    loadCurrentUser();
  }, [chatId]);

  const loadCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    } catch (error) {
      console.error('Error loading current user:', error);
    }
  };

  const loadGroupInfo = async () => {
    try {
      // Load group details
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .single();

      if (chatError) throw chatError;
      setGroupInfo(chat);

      // Load members
      const { data: participants, error: membersError } = await supabase
        .from('chat_participants')
        .select(`
          *
        `)
        .eq('chat_id', chatId);

      if (membersError) throw membersError;

      // Get profiles for each participant
      const participantsWithProfiles = await Promise.all(
        (participants || []).map(async (participant) => {
          try {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, phone, display_name, profile_photo_url')
              .eq('id', participant.user_id)
              .single();

            return {
              ...participant,
              profiles: profile
            };
          } catch (err) {
            return {
              ...participant,
              profiles: null
            };
          }
        })
      );

      setMembers(participantsWithProfiles);
    } catch (error) {
      console.error('Error loading group info:', error);
      Alert.alert('Error', 'Failed to load group information');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, phone, display_name, profile_photo_url')
        .not('id', 'in', `(${members.map(m => m.user_id).join(',')})`)
        .order('display_name');

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error loading available users:', error);
      Alert.alert('Error', 'Failed to load users');
    }
  };

  const changeGroupPhoto = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant photo library permissions.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadGroupPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error('Error changing photo:', error);
      Alert.alert('Error', 'Failed to change group photo');
    }
  };

  const uploadGroupPhoto = async (photo) => {
    try {
      const fileName = `group-photos/${Date.now()}.jpg`;
      const formData = new FormData();
      formData.append('file', {
        uri: photo.uri,
        type: 'image/jpeg',
        name: fileName,
      });

      const { data, error } = await supabase.storage
        .from('chat-images')
        .upload(fileName, formData, {
          contentType: 'image/jpeg',
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('chats')
        .update({ group_photo_url: publicUrl })
        .eq('id', chatId);

      if (updateError) throw updateError;

      setGroupInfo(prev => ({ ...prev, group_photo_url: publicUrl }));
      Alert.alert('Success', 'Group photo updated');
    } catch (error) {
      console.error('Error uploading photo:', error);
      Alert.alert('Error', 'Failed to update group photo');
    }
  };

  const addMembers = async () => {
    if (selectedUsers.size === 0) {
      Alert.alert('Error', 'Please select at least one member');
      return;
    }

    try {
      const newMembers = Array.from(selectedUsers).map(userId => ({
        chat_id: chatId,
        user_id: userId,
        role: 'member',
      }));

      const { error } = await supabase
        .from('chat_participants')
        .insert(newMembers);

      if (error) throw error;

      // Send system message
      const { data: { user } } = await supabase.auth.getUser();
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          author_id: user.id,
          content: `Added ${selectedUsers.size} member(s) to the group`,
          message_type: 'system',
        });

      if (messageError) throw messageError;

      Alert.alert('Success', 'Members added successfully');
      setShowAddMembers(false);
      setSelectedUsers(new Set());
      loadGroupInfo();
    } catch (error) {
      console.error('Error adding members:', error);
      Alert.alert('Error', 'Failed to add members');
    }
  };

  const removeMember = (memberId) => {
    const member = members.find(m => m.user_id === memberId);
    const isCurrentUser = memberId === currentUser?.id;
    const isAdmin = member?.role === 'admin';

    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${member?.profiles?.display_name || member?.profiles?.phone} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => performRemoveMember(memberId),
        },
      ]
    );
  };

  const performRemoveMember = async (memberId) => {
    try {
      const { error } = await supabase
        .from('chat_participants')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', memberId);

      if (error) throw error;

      // Send system message
      const { data: { user } } = await supabase.auth.getUser();
      const member = members.find(m => m.user_id === memberId);
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          author_id: user.id,
          content: `Removed ${member?.profiles?.display_name || member?.profiles?.phone} from the group`,
          message_type: 'system',
        });

      if (messageError) throw messageError;

      loadGroupInfo();
    } catch (error) {
      console.error('Error removing member:', error);
      Alert.alert('Error', 'Failed to remove member');
    }
  };

  const editGroupInfo = () => {
    setEditGroupName(groupInfo?.group_name || '');
    setEditGroupDescription(groupInfo?.group_description || '');
    setShowEditGroup(true);
  };

  const saveGroupChanges = async () => {
    if (!editGroupName.trim()) {
      Alert.alert('Error', 'Please enter a valid group name');
      return;
    }

    try {
      const { error } = await supabase
        .from('chats')
        .update({ 
          group_name: editGroupName.trim(),
          group_description: editGroupDescription.trim()
        })
        .eq('id', chatId);

      if (error) throw error;

      setGroupInfo(prev => ({ 
        ...prev, 
        group_name: editGroupName.trim(),
        group_description: editGroupDescription.trim()
      }));
      setShowEditGroup(false);
      Alert.alert('Success', 'Group information updated');
    } catch (error) {
      console.error('Error updating group info:', error);
      Alert.alert('Error', 'Failed to update group information');
    }
  };

  const deleteGroup = () => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This action cannot be undone and all messages will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: performDeleteGroup,
        },
      ]
    );
  };

  const performDeleteGroup = async () => {
    try {
      // Delete all messages first
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .eq('chat_id', chatId);

      if (messagesError) throw messagesError;

      // Delete all participants
      const { error: participantsError } = await supabase
        .from('chat_participants')
        .delete()
        .eq('chat_id', chatId);

      if (participantsError) throw participantsError;

      // Delete the group
      const { error: chatError } = await supabase
        .from('chats')
        .delete()
        .eq('id', chatId);

      if (chatError) throw chatError;

      Alert.alert('Success', 'Group deleted successfully', [
        { text: 'OK', onPress: () => navigation.navigate('Users') },
      ]);
    } catch (error) {
      console.error('Error deleting group:', error);
      Alert.alert('Error', 'Failed to delete group');
    }
  };

  const leaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: performLeaveGroup,
        },
      ]
    );
  };

  const performLeaveGroup = async () => {
    try {
      const { error } = await supabase
        .from('chat_participants')
        .delete()
        .eq('chat_id', chatId)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      // Send system message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          author_id: currentUser.id,
          content: 'Left the group',
          message_type: 'system',
        });

      if (messageError) throw messageError;

      Alert.alert('Success', 'You have left the group', [
        { text: 'OK', onPress: () => navigation.navigate('Users') },
      ]);
    } catch (error) {
      console.error('Error leaving group:', error);
      Alert.alert('Error', 'Failed to leave group');
    }
  };

  const isAdmin = () => {
    return members.find(m => m.user_id === currentUser?.id)?.role === 'admin';
  };

  const renderMember = ({ item }) => {
    const profile = item.profiles;
    const isMemberAdmin = item.role === 'admin';
    const isCurrentUserMember = item.user_id === currentUser?.id;

    return (
      <View style={[styles.memberItem, { backgroundColor: theme.surface }]}>
        <View style={styles.memberInfo}>
          {profile?.profile_photo_url ? (
            <Image source={{ uri: profile.profile_photo_url }} style={styles.memberAvatar} />
          ) : (
            <View style={[styles.memberAvatar, { backgroundColor: theme.primary }]}>
              <Ionicons name="person" size={20} color="white" />
            </View>
          )}
          <View style={styles.memberDetails}>
            <Text style={[styles.memberName, { color: theme.text }]}>
              {profile?.display_name || profile?.phone}
              {isCurrentUserMember && ' (You)'}
            </Text>
            {isMemberAdmin && (
              <Text style={[styles.memberRole, { color: theme.primary }]}>Admin</Text>
            )}
          </View>
        </View>
        {isAdmin() && !isCurrentUserMember && (
          <TouchableOpacity onPress={() => removeMember(item.user_id)}>
            <Ionicons name="close-circle" size={24} color={theme.error} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderAvailableUser = ({ item }) => {
    const isSelected = selectedUsers.has(item.id);

    return (
      <TouchableOpacity
        style={[
          styles.userItem,
          { backgroundColor: theme.surface },
          isSelected && { backgroundColor: theme.primary + '20' }
        ]}
        onPress={() => {
          const newSelected = new Set(selectedUsers);
          if (newSelected.has(item.id)) {
            newSelected.delete(item.id);
          } else {
            newSelected.add(item.id);
          }
          setSelectedUsers(newSelected);
        }}
      >
        <View style={styles.userInfo}>
          {item.profile_photo_url ? (
            <Image source={{ uri: item.profile_photo_url }} style={styles.userAvatar} />
          ) : (
            <View style={[styles.userAvatar, { backgroundColor: theme.primary }]}>
              <Ionicons name="person" size={20} color="white" />
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={[styles.userName, { color: theme.text }]}>
              {item.display_name || item.phone}
            </Text>
            <Text style={[styles.userPhone, { color: theme.textSecondary }]}>
              {item.phone}
            </Text>
          </View>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: theme.text }]}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={styles.groupHeader}>
          <TouchableOpacity style={styles.groupPhotoContainer} onPress={changeGroupPhoto}>
            {groupInfo?.group_photo_url ? (
              <Image source={{ uri: groupInfo.group_photo_url }} style={styles.groupPhoto} />
            ) : (
              <View style={[styles.groupPhotoPlaceholder, { backgroundColor: theme.primary }]}>
                <Ionicons name="people" size={40} color="white" />
              </View>
            )}
            <View style={[styles.cameraIcon, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={16} color="white" />
            </View>
          </TouchableOpacity>

          <View style={styles.groupInfo}>
            <Text style={[styles.groupName, { color: theme.text }]}>
              {groupInfo?.group_name}
            </Text>
            {groupInfo?.group_description && (
              <Text style={[styles.groupDescription, { color: theme.textSecondary }]}>
                {groupInfo.group_description}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.membersSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Members ({members.length})
            </Text>
            {isAdmin() && (
              <TouchableOpacity
                style={[styles.addButton, { backgroundColor: theme.primary }]}
                onPress={() => {
                  setShowAddMembers(true);
                  loadAvailableUsers();
                }}
              >
                <Ionicons name="add" size={20} color="white" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={members}
            renderItem={renderMember}
            keyExtractor={(item) => item.user_id}
            style={styles.membersList}
          />
        </View>

        <View style={styles.actionButtons}>
          {isAdmin() && (
            <>
              <TouchableOpacity
                style={[styles.actionIconButton, { backgroundColor: theme.primary }]}
                onPress={editGroupInfo}
              >
                <Ionicons name="create" size={24} color="white" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.actionIconButton, { backgroundColor: theme.error }]}
                onPress={deleteGroup}
              >
                <Ionicons name="trash" size={24} color="white" />
              </TouchableOpacity>
            </>
          )}
          
          <TouchableOpacity
            style={[styles.actionIconButton, { backgroundColor: theme.error }]}
            onPress={leaveGroup}
          >
            <Ionicons name="exit" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={showAddMembers}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowAddMembers(false)}>
              <Text style={[styles.cancelButton, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Add Members</Text>
            <TouchableOpacity onPress={addMembers}>
              <Text style={[styles.addButtonText, { color: theme.primary }]}>Add</Text>
            </TouchableOpacity>
          </View>

          <FlatList
            data={availableUsers}
            renderItem={renderAvailableUser}
            keyExtractor={(item) => item.id}
            style={styles.modalContent}
          />
        </SafeAreaView>
      </Modal>

      <Modal
        visible={showEditGroup}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: theme.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: theme.border }]}>
            <TouchableOpacity onPress={() => setShowEditGroup(false)}>
              <Text style={[styles.cancelButton, { color: theme.text }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Edit Group</Text>
            <TouchableOpacity onPress={saveGroupChanges}>
              <Text style={[styles.addButtonText, { color: theme.primary }]}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.editForm}>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Group Name</Text>
              <TextInput
                style={[styles.editInput, { 
                  color: theme.text, 
                  borderBottomColor: theme.border,
                  backgroundColor: theme.surface 
                }]}
                placeholder="Enter group name"
                placeholderTextColor={theme.textSecondary}
                value={editGroupName}
                onChangeText={setEditGroupName}
                maxLength={25}
              />

              <Text style={[styles.inputLabel, { color: theme.text }]}>Group Description</Text>
              <TextInput
                style={[styles.editTextArea, { 
                  color: theme.text, 
                  borderBottomColor: theme.border,
                  backgroundColor: theme.surface 
                }]}
                placeholder="Enter group description (optional)"
                placeholderTextColor={theme.textSecondary}
                value={editGroupDescription}
                onChangeText={setEditGroupDescription}
                maxLength={100}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  groupHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  groupPhotoContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  groupPhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  groupPhotoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfo: {
    alignItems: 'center',
  },
  groupName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  groupDescription: {
    fontSize: 16,
    textAlign: 'center',
  },
  membersSection: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  membersList: {
    flex: 1,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberDetails: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '500',
  },
  memberRole: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 16,
  },
  actionIconButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  cancelButton: {
    fontSize: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '500',
  },
  userPhone: {
    fontSize: 14,
    marginTop: 2,
  },
  editForm: {
    padding: 16,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  editInput: {
    fontSize: 16,
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  editTextArea: {
    fontSize: 16,
    borderBottomWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    minHeight: 80,
    textAlignVertical: 'top',
  },
});
