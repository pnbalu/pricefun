import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  Alert,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { AgentSelectionCard } from '../components/AgentSelectionCard';
import * as ImagePicker from 'expo-image-picker';

export function CreateGroupScreen({ navigation }) {
  const { theme } = useTheme();
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [selectedAgents, setSelectedAgents] = useState(new Set());
  const [availableUsers, setAvailableUsers] = useState([]);
  const [availableAgents, setAvailableAgents] = useState([]);
  const [groupPhoto, setGroupPhoto] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAvailableUsers();
    loadAvailableAgents();
  }, []);

  const loadAvailableUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, phone, display_name, profile_photo_url')
        .neq('id', user.id)
        .order('display_name');

      if (error) throw error;
      setAvailableUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
      Alert.alert('Error', 'Failed to load users');
    }
  };

  const loadAvailableAgents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('agent_name');

      if (error) throw error;
      setAvailableAgents(data || []);
    } catch (error) {
      console.error('Error loading agents:', error);
      Alert.alert('Error', 'Failed to load AI agents');
    }
  };

  const toggleMemberSelection = (userId) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedMembers(newSelected);
  };

  const toggleAgentSelection = (agentId) => {
    const newSelected = new Set(selectedAgents);
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId);
    } else {
      newSelected.add(agentId);
    }
    setSelectedAgents(newSelected);
  };

  const pickGroupPhoto = async () => {
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
        setGroupPhoto(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking photo:', error);
      Alert.alert('Error', 'Failed to pick photo');
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

      return publicUrl;
    } catch (error) {
      console.error('Error uploading photo:', error);
      throw error;
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter a group name');
      return;
    }

    if (selectedMembers.size === 0) {
      Alert.alert('Error', 'Please select at least one member');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Not signed in');
        return;
      }

      let groupPhotoUrl = null;
      if (groupPhoto) {
        groupPhotoUrl = await uploadGroupPhoto(groupPhoto);
      }

      // Create group chat
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          is_group: true,
          group_name: groupName.trim(),
          group_description: groupDescription.trim(),
          group_photo_url: groupPhotoUrl,
          created_by: user.id,
        })
        .select('*')
        .single();

      if (chatError) throw chatError;

      // Add creator as admin
      const { error: creatorError } = await supabase
        .from('chat_participants')
        .insert({
          chat_id: chat.id,
          user_id: user.id,
          role: 'admin',
        });

      if (creatorError) throw creatorError;

      // Add selected members
      const members = Array.from(selectedMembers).map(userId => ({
        chat_id: chat.id,
        user_id: userId,
        role: 'member',
      }));

      const { error: membersError } = await supabase
        .from('chat_participants')
        .insert(members);

      if (membersError) throw membersError;

      // Add selected agents
      if (selectedAgents.size > 0) {
        const agentParticipants = Array.from(selectedAgents).map(agentId => ({
          chat_id: chat.id,
          agent_id: agentId,
        }));

        const { error: agentsError } = await supabase
          .from('agent_chat_participants')
          .insert(agentParticipants);

        if (agentsError) throw agentsError;
      }

      // Send welcome message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: chat.id,
          author_id: user.id,
          content: `Group "${groupName}" was created`,
          message_type: 'system',
        });

      if (messageError) throw messageError;

      Alert.alert('Success', 'Group created successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Chat', { chatId: chat.id }),
        },
      ]);
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const renderUser = ({ item }) => {
    const isSelected = selectedMembers.has(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.userItem,
          { backgroundColor: theme.surface },
          isSelected && { backgroundColor: theme.primary + '20' }
        ]}
        onPress={() => toggleMemberSelection(item.id)}
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={styles.groupInfo}>
          <TouchableOpacity style={styles.photoContainer} onPress={pickGroupPhoto}>
            {groupPhoto ? (
              <Image source={{ uri: groupPhoto.uri }} style={styles.groupPhoto} />
            ) : (
              <View style={[styles.groupPhotoPlaceholder, { backgroundColor: theme.primary }]}>
                <Ionicons name="camera" size={30} color="white" />
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.groupDetails}>
            <TextInput
              style={[styles.groupNameInput, { color: theme.text, borderBottomColor: theme.border }]}
              placeholder="Group name"
              placeholderTextColor={theme.textSecondary}
              value={groupName}
              onChangeText={setGroupName}
              maxLength={25}
            />
            <TextInput
              style={[styles.groupDescriptionInput, { color: theme.text, borderBottomColor: theme.border }]}
              placeholder="Group description (optional)"
              placeholderTextColor={theme.textSecondary}
              value={groupDescription}
              onChangeText={setGroupDescription}
              maxLength={100}
              multiline
            />
          </View>
        </View>

        <View style={styles.membersSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Add Members ({selectedMembers.size})
          </Text>
          <FlatList
            data={availableUsers}
            renderItem={renderUser}
            keyExtractor={(item) => item.id}
            style={styles.membersList}
          />
        </View>

        {/* AI Agents Section */}
        {availableAgents.length > 0 && (
          <View style={styles.agentsSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Add AI Agents ({selectedAgents.size})
            </Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Select AI agents to add to this group
            </Text>
            <FlatList
              data={availableAgents}
              renderItem={({ item: agent }) => (
                <AgentSelectionCard
                  agent={agent}
                  isSelected={selectedAgents.has(agent.id)}
                  onToggle={() => toggleAgentSelection(agent.id)}
                />
              )}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.agentsList}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.createButton, { backgroundColor: theme.primary }]}
          onPress={createGroup}
          disabled={loading}
        >
          <Text style={styles.createButtonText}>
            {loading ? 'Creating...' : 'Create Group'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  photoContainer: {
    marginRight: 16,
  },
  groupPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  groupPhotoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupDetails: {
    flex: 1,
  },
  groupNameInput: {
    fontSize: 18,
    fontWeight: '600',
    borderBottomWidth: 1,
    paddingVertical: 8,
    marginBottom: 8,
  },
  groupDescriptionInput: {
    fontSize: 14,
    borderBottomWidth: 1,
    paddingVertical: 8,
    minHeight: 40,
  },
  membersSection: {
    flex: 1,
  },
  agentsSection: {
    marginBottom: 24,
  },
  sectionSubtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  agentsList: {
    paddingRight: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  membersList: {
    flex: 1,
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
  createButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  createButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
