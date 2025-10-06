import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export function AgentCard({ agent, onEdit, onDelete, onToggleStatus, showActions = true }) {
  const { theme } = useTheme();

  return (
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
        </View>
      </View>
      
      {showActions && (
        <View style={styles.agentActions}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: agent.is_active ? theme.error + '20' : theme.primary + '20' }]}
            onPress={() => onToggleStatus(agent.id, agent.is_active)}
          >
            <Ionicons 
              name={agent.is_active ? 'pause' : 'play'} 
              size={20} 
              color={agent.is_active ? theme.error : theme.primary} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.primary + '20' }]}
            onPress={() => onEdit(agent.id)}
          >
            <Ionicons name="create" size={20} color={theme.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: theme.error + '20' }]}
            onPress={() => onDelete(agent.id)}
          >
            <Ionicons name="trash" size={20} color={theme.error} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
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
});
