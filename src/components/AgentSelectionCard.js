import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export function AgentSelectionCard({ agent, isSelected, onToggle }) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity 
      style={[
        styles.agentCard, 
        { 
          backgroundColor: theme.surface,
          borderColor: isSelected ? theme.primary : theme.border,
          borderWidth: isSelected ? 2 : 1
        }
      ]}
      onPress={onToggle}
    >
      <View style={styles.avatarContainer}>
        {agent.avatar_url ? (
          <Image source={{ uri: agent.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.defaultAvatar, { backgroundColor: theme.primary }]}>
              <Ionicons name="logo-reddit" size={20} color="white" />
          </View>
        )}
        
        {isSelected && (
          <View style={[styles.selectedOverlay, { backgroundColor: theme.primary }]}>
            <Ionicons name="checkmark" size={16} color="white" />
          </View>
        )}
        
        <View style={[
          styles.statusDot, 
          { backgroundColor: agent.is_active ? '#4CAF50' : '#F44336' }
        ]} />
      </View>
      
      <Text style={[styles.agentName, { color: theme.text }]} numberOfLines={1}>
        {agent.agent_name}
      </Text>
      
      {agent.trigger_keyword && (
        <Text style={[styles.triggerKeyword, { color: theme.primary }]} numberOfLines={1}>
          @{agent.trigger_keyword}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  agentCard: {
    width: 100,
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginRight: 12,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
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
  selectedOverlay: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
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
  agentName: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 2,
  },
  triggerKeyword: {
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
});
