import { useEffect, useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, Text, Image, Alert, SafeAreaView } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

export function AIAgentsScreen({ navigation }) {
  const { theme } = useTheme();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadAgents = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: agentsData, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching agents:', error);
        return;
      }

      setAgents(agentsData || []);
    } catch (error) {
      console.error('Error in loadAgents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Refresh data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadAgents();
    }, [loadAgents])
  );

  const deleteAgent = (agentId) => {
    Alert.alert(
      'Delete Agent',
      'Are you sure you want to delete this AI agent? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('ai_agents')
                .delete()
                .eq('id', agentId);

              if (error) throw error;

              setAgents(prev => prev.filter(agent => agent.id !== agentId));
              Alert.alert('Success', 'Agent deleted successfully');
            } catch (error) {
              console.error('Error deleting agent:', error);
              Alert.alert('Error', 'Failed to delete agent');
            }
          },
        },
      ]
    );
  };

  const toggleAgentStatus = async (agentId, currentStatus) => {
    try {
      const { error } = await supabase
        .from('ai_agents')
        .update({ is_active: !currentStatus })
        .eq('id', agentId);

      if (error) throw error;

      setAgents(prev => 
        prev.map(agent => 
          agent.id === agentId 
            ? { ...agent, is_active: !currentStatus }
            : agent
        )
      );
    } catch (error) {
      console.error('Error updating agent status:', error);
      Alert.alert('Error', 'Failed to update agent status');
    }
  };

  const renderAgentCard = ({ item: agent }) => (
    <View style={[styles.agentCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.agentInfo}>
        <View style={styles.avatarContainer}>
          {agent.avatar_url ? (
            <Image source={{ uri: agent.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.defaultAvatar, { backgroundColor: theme.primary }]}>
              <Ionicons name="logo-reddit" size={24} color="white" />
            </View>
          )}
          <View style={[
            styles.statusDot, 
            { backgroundColor: agent.is_active ? '#4CAF50' : '#F44336' }
          ]} />
        </View>
        
        <View style={styles.agentDetails}>
          <View style={styles.agentHeader}>
            <Text style={[styles.agentName, { color: theme.text }]}>
              {agent.agent_name}
            </Text>
            <View style={[styles.agentBadge, { backgroundColor: theme.primary + '20' }]}>
              <Text style={[styles.agentBadgeText, { color: theme.primary }]}>
                AI Agent
              </Text>
            </View>
          </View>
          
          {agent.agent_description && (
            <Text style={[styles.agentDescription, { color: theme.textSecondary }]} numberOfLines={2}>
              {agent.agent_description}
            </Text>
          )}
          
          {agent.trigger_keyword && (
            <Text style={[styles.triggerKeyword, { color: theme.primary }]}>
              Trigger: @{agent.trigger_keyword}
            </Text>
          )}
          
          <Text style={[styles.workflowId, { color: theme.textSecondary }]}>
            Workflow: {agent.n8n_workflow_id}
          </Text>
        </View>
      </View>
      
      <View style={styles.agentActions}>
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: agent.is_active ? theme.error + '20' : theme.primary + '20' }]}
          onPress={() => toggleAgentStatus(agent.id, agent.is_active)}
        >
          <Ionicons 
            name={agent.is_active ? 'pause' : 'play'} 
            size={20} 
            color={agent.is_active ? theme.error : theme.primary} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.primary + '20' }]}
          onPress={() => navigation.navigate('EditAgent', { agentId: agent.id })}
        >
          <Ionicons name="create" size={20} color={theme.primary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: theme.error + '20' }]}
          onPress={() => deleteAgent(agent.id)}
        >
          <Ionicons name="trash" size={20} color={theme.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.primary + '20' }]}>
            <Ionicons name="logo-reddit" size={64} color={theme.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No AI Agents yet</Text>
      <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
        Create your first AI agent to automate your conversations
      </Text>
      <TouchableOpacity 
        style={[styles.createFirstButton, { backgroundColor: theme.primary }]}
        onPress={() => navigation.navigate('CreateAgent')}
      >
        <Ionicons name="add" size={20} color="white" />
        <Text style={styles.createFirstButtonText}>Create Your First Agent</Text>
      </TouchableOpacity>
    </View>
  );

  // Configure navigation header
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity 
          style={[styles.headerButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.navigate('CreateAgent')}
        >
          <Ionicons name="add" size={20} color="white" />
        </TouchableOpacity>
      ),
    });
  }, [navigation, theme.primary]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Agents List */}
      <FlatList
        data={agents}
        keyExtractor={(item) => item.id}
        renderItem={renderAgentCard}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmptyState}
        refreshing={loading}
        onRefresh={loadAgents}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  listContainer: {
    padding: 16,
    gap: 12,
  },
  agentCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  agentInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  defaultAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  agentDetails: {
    flex: 1,
  },
  agentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  agentName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  agentBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  agentBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  agentDescription: {
    fontSize: 14,
    marginBottom: 4,
  },
  triggerKeyword: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  workflowId: {
    fontSize: 12,
    fontFamily: 'monospace',
  },
  agentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  createFirstButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
