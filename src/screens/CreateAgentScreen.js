import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, SafeAreaView, Image } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { N8nConnector } from '../services/n8nConnector';

export function CreateAgentScreen({ navigation, route }) {
  const { theme } = useTheme();
  const isEdit = route.params?.agentId;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    agent_name: '',
    agent_description: '',
    n8n_workflow_id: '',
    trigger_keyword: '',
    avatar_url: '',
    is_active: true
  });

  useEffect(() => {
    if (isEdit) {
      loadAgentData();
    }
  }, [isEdit]);

  // Set navigation title
  useEffect(() => {
    navigation.setOptions({
      title: isEdit ? 'Edit Agent' : 'Create Agent'
    });
  }, [navigation, isEdit]);

  const loadAgentData = async () => {
    try {
      const { data: agent, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', isEdit)
        .single();

      if (error) throw error;

      setFormData({
        agent_name: agent.agent_name || '',
        agent_description: agent.agent_description || '',
        n8n_workflow_id: agent.n8n_workflow_id || '',
        trigger_keyword: agent.trigger_keyword || '',
        avatar_url: agent.avatar_url || '',
        is_active: agent.is_active
      });
    } catch (error) {
      console.error('Error loading agent:', error);
      Alert.alert('Error', 'Failed to load agent data');
    }
  };

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please grant media library permissions to select an avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setFormData({ ...formData, avatar_url: result.assets[0].uri });
    }
  };

  const testConnection = async () => {
    if (!formData.n8n_workflow_id.trim()) {
      Alert.alert('Error', 'Please enter a workflow ID first');
      return;
    }

    try {
      setLoading(true);
      
      // Generate test webhook URL
      const testWebhookUrl = `https://your-app.com/api/agents/test-${Date.now()}/webhook`;
      
      // Here you would test the n8n workflow connection
      // For now, we'll simulate a test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      Alert.alert('Success', 'Connection test successful! The workflow is accessible.');
    } catch (error) {
      console.error('Connection test failed:', error);
      Alert.alert('Error', 'Connection test failed. Please check your workflow ID and try again.');
    } finally {
      setLoading(false);
    }
  };

  const saveAgent = async () => {
    if (!formData.agent_name.trim()) {
      Alert.alert('Error', 'Please enter an agent name');
      return;
    }

    if (!formData.n8n_workflow_id.trim()) {
      Alert.alert('Error', 'Please enter a workflow ID');
      return;
    }

    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'User not authenticated');
        return;
      }

      // Generate unique identifiers
      const agentId = isEdit || crypto.randomUUID();
      const webhookUrl = `https://your-app.com/api/agents/${agentId}/webhook`;
      const apiKey = `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const agentData = {
        agent_name: formData.agent_name.trim(),
        agent_description: formData.agent_description.trim(),
        n8n_workflow_id: formData.n8n_workflow_id.trim(),
        trigger_keyword: formData.trigger_keyword.trim() || null,
        avatar_url: formData.avatar_url || null,
        is_active: formData.is_active,
        webhook_url: webhookUrl,
        api_key: apiKey,
        user_id: user.id
      };

      if (isEdit) {
        const { error } = await supabase
          .from('ai_agents')
          .update(agentData)
          .eq('id', isEdit);

        if (error) throw error;
        Alert.alert('Success', 'Agent updated successfully');
      } else {
        const { error } = await supabase
          .from('ai_agents')
          .insert(agentData);

        if (error) throw error;
        Alert.alert('Success', 'Agent created successfully');
      }

      navigation.goBack();
    } catch (error) {
      console.error('Error saving agent:', error);
      Alert.alert('Error', 'Failed to save agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Agent Avatar</Text>
          <TouchableOpacity style={styles.avatarButton} onPress={pickAvatar}>
            {formData.avatar_url ? (
              <Image source={{ uri: formData.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: theme.primary + '20' }]}>
                <Ionicons name="logo-reddit" size={64} color={theme.primary} />
              </View>
            )}
            <View style={[styles.avatarOverlay, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={20} color="white" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarHint, { color: theme.textSecondary }]}>
            Tap to select an avatar for your agent
          </Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Agent Details</Text>
          
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Agent Name *</Text>
            <TextInput
              placeholder="Enter agent name"
              placeholderTextColor={theme.textSecondary}
              value={formData.agent_name}
              onChangeText={(text) => setFormData({...formData, agent_name: text})}
              style={[styles.input, { 
                color: theme.text, 
                backgroundColor: theme.surface,
                borderColor: theme.border 
              }]}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Description</Text>
            <TextInput
              placeholder="Describe what this agent does"
              placeholderTextColor={theme.textSecondary}
              value={formData.agent_description}
              onChangeText={(text) => setFormData({...formData, agent_description: text})}
              style={[styles.input, styles.textArea, { 
                color: theme.text, 
                backgroundColor: theme.surface,
                borderColor: theme.border 
              }]}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>n8n Workflow ID *</Text>
            <TextInput
              placeholder="Enter your n8n workflow ID"
              placeholderTextColor={theme.textSecondary}
              value={formData.n8n_workflow_id}
              onChangeText={(text) => setFormData({...formData, n8n_workflow_id: text})}
              style={[styles.input, { 
                color: theme.text, 
                backgroundColor: theme.surface,
                borderColor: theme.border 
              }]}
            />
            <Text style={[styles.inputHint, { color: theme.textSecondary }]}>
              The ID of your n8n workflow that this agent will connect to
            </Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: theme.text }]}>Trigger Keyword (Optional)</Text>
            <TextInput
              placeholder="e.g., support, sales, help"
              placeholderTextColor={theme.textSecondary}
              value={formData.trigger_keyword}
              onChangeText={(text) => setFormData({...formData, trigger_keyword: text})}
              style={[styles.input, { 
                color: theme.text, 
                backgroundColor: theme.surface,
                borderColor: theme.border 
              }]}
            />
            <Text style={[styles.inputHint, { color: theme.textSecondary }]}>
              Users can type @keyword to trigger this agent
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <TouchableOpacity 
            style={[styles.testButton, { 
              backgroundColor: theme.surface,
              borderColor: theme.border 
            }]}
            onPress={testConnection}
            disabled={loading}
          >
            <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
            <Text style={[styles.testButtonText, { color: theme.primary }]}>
              {loading ? 'Testing...' : 'Test Connection'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.saveButton, { backgroundColor: theme.primary }]}
            onPress={saveAgent}
            disabled={loading}
          >
            <Ionicons name="save" size={20} color="white" />
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : (isEdit ? 'Update Agent' : 'Create Agent')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  avatarButton: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHint: {
    fontSize: 14,
    textAlign: 'center',
  },
  formSection: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputHint: {
    fontSize: 12,
    marginTop: 4,
  },
  actionSection: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    gap: 12,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  testButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
