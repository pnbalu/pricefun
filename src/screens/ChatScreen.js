import { useEffect, useRef, useState, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, Alert, Image, Text, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { Audio, Video } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';

export function ChatScreen({ route }) {
  const { chatId } = route.params;
  const { theme } = useTheme();
  const navigation = useNavigation();
  const [text, setText] = useState('');
  const [messages, setMessages] = useState([]);
  const flatListRef = useRef(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [chatTitle, setChatTitle] = useState('Chat');
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const recordingTimer = useRef(null);
  const headerHeight = useHeaderHeight();

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
    }
  };


  const loadChatTitle = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      // Get the other participant's profile
      const { data: participants } = await supabase
        .from('chat_participants')
        .select(`
          profiles!inner(id, display_name, phone)
        `)
        .eq('chat_id', chatId)
        .neq('user_id', user.id);

      if (participants && participants.length > 0) {
        const otherProfile = participants[0].profiles;
        const title = otherProfile.display_name || otherProfile.phone;
        setChatTitle(title);
        navigation.setOptions({ title });
      } else {
        // Fallback: try to get chat info from chats_view
        const { data: chatInfo } = await supabase
          .from('chats_view')
          .select('title')
          .eq('id', chatId)
          .single();
        
        if (chatInfo) {
          setChatTitle(chatInfo.title);
          navigation.setOptions({ title: chatInfo.title });
        }
      }
    } catch (error) {
      console.error('Error loading chat title:', error);
      // Keep the original title if there's an error
    }
  }, [chatId, navigation]);

  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);
    setTimeout(() => {
      if (shouldAutoScroll && !isUserScrolling) {
        flatListRef.current?.scrollToEnd({ animated: false });
      }
    }, 100);
  }, [chatId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setCurrentUserId(user?.id ?? null));
  }, []);

  useEffect(() => {
    loadChatTitle();
    loadMessages();

    const channel = supabase
      .channel(`realtime:messages:${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        // Debug: console.log('realtime payload', payload);
        if (payload.new?.chat_id !== chatId) return;
        setMessages((prev) => {
          if (prev.some((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new];
        });
        setTimeout(() => {
          if (shouldAutoScroll && !isUserScrolling) {
            flatListRef.current?.scrollToEnd({ animated: true });
          }
        }, 100);
      })
      .subscribe((status) => {
        // console.log('channel status', status);
        if (status === 'SUBSCRIBED') {
          // Ensure we are in sync when subscribed
          loadMessages();
        }
      });

    const pollId = setInterval(loadMessages, 3000);

    return () => {
      clearInterval(pollId);
      supabase.removeChannel(channel);
    };
  }, [chatId, loadChatTitle, loadMessages]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
      setPlayingAudio(null);
    };
  }, []);

  // Refresh title when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadChatTitle();
    }, [loadChatTitle])
  );

  // Update header based on selection mode
  useEffect(() => {
    if (isSelectionMode) {
      navigation.setOptions({
        title: `${selectedMessages.size} selected`,
        headerLeft: () => (
          <TouchableOpacity onPress={toggleSelectionMode} style={{ padding: 8 }}>
            <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
          </TouchableOpacity>
        ),
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity 
              onPress={clearSelection} 
              style={{ marginRight: 16, padding: 8 }}
            >
              <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '600' }}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={selectAllMessages} 
              style={{ marginRight: 16, padding: 8 }}
            >
              <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '600' }}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              onPress={deleteSelectedMessages}
              disabled={selectedMessages.size === 0}
              style={{ padding: 8 }}
            >
              <Text style={{ 
                color: selectedMessages.size > 0 ? theme.error : theme.textSecondary,
                fontSize: 16,
                fontWeight: '600'
              }}>
                Delete
              </Text>
            </TouchableOpacity>
          </View>
        ),
      });
    } else {
      navigation.setOptions({
        title: chatTitle,
        headerLeft: () => null,
        headerRight: () => (
          <TouchableOpacity onPress={toggleSelectionMode} style={{ padding: 8 }}>
            <Text style={{ color: theme.primary, fontSize: 16, fontWeight: '600' }}>Select</Text>
          </TouchableOpacity>
        ),
      });
    }
  }, [isSelectionMode, selectedMessages.size, chatTitle, theme.primary, theme.error, theme.textSecondary, navigation]);

  // Mark chat as read when mounting and when new messages arrive
  useEffect(() => {
    const markRead = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('chat_participants').update({ last_read_at: new Date().toISOString() }).eq('chat_id', chatId).eq('user_id', user.id);
    };
    markRead();
  }, [chatId, messages.length]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authorId = session?.user.id;
    if (!authorId) {
      Alert.alert('Not signed in');
      return;
    }
    // Optimistic message
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, chat_id: chatId, author_id: authorId, content: trimmed, created_at: new Date().toISOString() };
    setMessages((prev) => [...prev, optimistic]);
    setTimeout(() => {
      if (shouldAutoScroll && !isUserScrolling) {
        flatListRef.current?.scrollToEnd({ animated: true });
      }
    }, 100);

    const { data, error } = await supabase
      .from('messages')
      .insert({ chat_id: chatId, author_id: authorId, content: trimmed })
      .select('*')
      .single();
    if (error) {
      // If RLS prevents insert (not a participant), nothing will render; surface the error.
      console.warn('send error', error);
      Alert.alert('Send failed', error.message);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      return;
    }
    if (data) {
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const pickImageFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to send images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
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
        aspect: [4, 3],
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadImage(result.assets[0]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo');
    }
  };

  const takeVideo = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera permissions to record videos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'videos',
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60,
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadVideo(result.assets[0]);
      }
    } catch (error) {
      console.error('Error taking video:', error);
      Alert.alert('Error', 'Failed to take video');
    }
  };

  const pickVideoFromLibrary = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to send videos.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'videos',
        allowsEditing: true,
        quality: 0.8,
        videoMaxDuration: 60, // Max 60 seconds
        base64: false,
      });

      if (!result.canceled && result.assets[0]) {
        await uploadVideo(result.assets[0]);
      }
    } catch (error) {
      console.error('Error picking video from library:', error);
      Alert.alert('Error', 'Failed to pick video from library');
    }
  };

  const showMediaPicker = () => {
      Alert.alert(
        'Choose Media',
        'What would you like to send?',
        [
          {
            text: 'Take Photo',
            onPress: takePhoto,
          },
          {
            text: 'Photo Library',
            onPress: pickImageFromLibrary,
          },
          {
            text: 'Record Video',
            onPress: takeVideo,
          },
          {
            text: 'Video Library',
            onPress: pickVideoFromLibrary,
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ],
        { cancelable: true }
      );
  };

  const uploadImage = async (asset) => {
    const tempId = `temp-${Date.now()}`;
    
    try {
      setUploading(true);

      const { data: { session } } = await supabase.auth.getSession();
      const authorId = session?.user.id;
      if (!authorId) {
        Alert.alert('Not signed in');
        return;
      }

      // Create optimistic message
      const optimistic = {
        id: tempId,
        chat_id: chatId,
        author_id: authorId,
                content: 'Uploading image...',
        message_type: 'image',
        image_url: asset.uri,
        image_width: asset.width,
        image_height: asset.height,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, optimistic]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Upload to Supabase Storage
      const fileName = `${chatId}/${tempId}.jpg`;
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: 'image/jpeg',
        name: fileName,
      });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-images')
        .upload(fileName, formData, {
          contentType: 'image/jpeg',
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-images')
        .getPublicUrl(fileName);

      // Insert message into database
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          author_id: authorId,
          content: 'Image',
          message_type: 'image',
          image_url: publicUrl,
          image_width: asset.width,
          image_height: asset.height,
        })
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      // Update optimistic message with real data
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload failed', error.message);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant microphone permissions to record voice messages.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Start timer
      recordingTimer.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      clearInterval(recordingTimer.current);
      
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      
      if (uri && recordingDuration > 0) {
        await uploadVoiceMessage(uri, recordingDuration);
      }
      
      setRecordingDuration(0);
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const uploadVoiceMessage = async (uri, duration) => {
    const tempId = `temp-${Date.now()}`;
    
    try {
      setUploading(true);

      const { data: { session } } = await supabase.auth.getSession();
      const authorId = session?.user.id;
      if (!authorId) {
        Alert.alert('Not signed in');
        return;
      }

      // Create optimistic message
      const optimistic = {
        id: tempId,
        chat_id: chatId,
        author_id: authorId,
        content: `Voice ${duration}s`,
        message_type: 'voice',
        voice_url: uri,
        voice_duration: duration,
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, optimistic]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Upload to Supabase Storage
      const fileName = `${chatId}/${tempId}.m4a`;
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        type: 'audio/m4a',
        name: fileName,
      });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-voice')
        .upload(fileName, formData, {
          contentType: 'audio/m4a',
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-voice')
        .getPublicUrl(fileName);

      // Insert message into database
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          author_id: authorId,
          content: `Voice ${duration}s`,
          message_type: 'voice',
          voice_url: publicUrl,
          voice_duration: duration,
        })
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      // Update optimistic message with real data
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload failed', error.message);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setUploading(false);
    }
  };

  const uploadVideo = async (asset) => {
    const tempId = `temp-${Date.now()}`;
    
    try {
      setUploading(true);

      const { data: { session } } = await supabase.auth.getSession();
      const authorId = session?.user.id;
      if (!authorId) {
        Alert.alert('Not signed in');
        return;
      }

      // Create optimistic message
      const optimistic = {
        id: tempId,
        chat_id: chatId,
        author_id: authorId,
                content: 'Uploading video...',
        message_type: 'video',
        video_url: asset.uri,
        video_duration: Math.round(asset.duration || 0),
        created_at: new Date().toISOString()
      };
      setMessages((prev) => [...prev, optimistic]);
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Upload to Supabase Storage
      const fileName = `${chatId}/${tempId}.mp4`;
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: 'video/mp4',
        name: fileName,
      });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-video')
        .upload(fileName, formData, {
          contentType: 'video/mp4',
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-video')
        .getPublicUrl(fileName);

      // Insert message into database
      const { data, error } = await supabase
        .from('messages')
        .insert({
          chat_id: chatId,
          author_id: authorId,
          content: `Video ${Math.round(asset.duration || 0)}s`,
          message_type: 'video',
          video_url: publicUrl,
          video_duration: Math.round(asset.duration || 0),
        })
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      // Update optimistic message with real data
      setMessages((prev) => prev.map((m) => (m.id === tempId ? data : m)));
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload failed', error.message);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setUploading(false);
    }
  };

  const playVoiceMessage = async (uri, messageId) => {
    try {
      if (playingAudio === messageId) {
        // Stop current playback
        setPlayingAudio(null);
        return;
      }

      console.log('Playing voice message:', uri);

      // Set audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      setPlayingAudio(messageId);
      
      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true },
        (status) => {
          console.log('Audio status:', status);
          if (status.didJustFinish) {
            setPlayingAudio(null);
            sound.unloadAsync();
          }
        }
      );
      
    } catch (error) {
      console.error('Error playing audio:', error);
      console.error('Audio URI:', uri);
      Alert.alert('Playback Error', `Could not play voice message: ${error.message}`);
      setPlayingAudio(null);
    }
  };

  const deleteMessage = async (messageId, isAuthor) => {
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete for me',
        onPress: async () => {
          await supabase.from('message_hides').insert({ message_id: messageId, user_id: currentUserId });
          setMessages((prev) => prev.filter((m) => m.id !== messageId));
        },
      },
      isAuthor && {
        text: 'Delete for everyone',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('messages').delete().eq('id', messageId);
        },
      },
    ]);
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedMessages(new Set());
  };

  const toggleMessageSelection = (messageId) => {
    const newSelected = new Set(selectedMessages);
    if (newSelected.has(messageId)) {
      newSelected.delete(messageId);
    } else {
      newSelected.add(messageId);
    }
    setSelectedMessages(newSelected);
  };

  const selectAllMessages = () => {
    const allMessageIds = new Set(messages.map(m => m.id));
    setSelectedMessages(allMessageIds);
  };

  const clearSelection = () => {
    setSelectedMessages(new Set());
  };

  const deleteSelectedMessages = async () => {
    if (selectedMessages.size === 0) return;

    const messageCount = selectedMessages.size;
    Alert.alert(
      'Delete Messages', 
      `Are you sure you want to delete ${messageCount} message${messageCount > 1 ? 's' : ''}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete for me',
          onPress: async () => {
            try {
              const messageIds = Array.from(selectedMessages);
              await Promise.all(
                messageIds.map(messageId =>
                  supabase.from('message_hides').insert({ message_id: messageId, user_id: currentUserId })
                )
              );
              setMessages((prev) => prev.filter((m) => !selectedMessages.has(m.id)));
              setSelectedMessages(new Set());
              setIsSelectionMode(false);
            } catch (error) {
              console.error('Error deleting messages:', error);
              Alert.alert('Error', 'Failed to delete messages');
            }
          },
        },
        {
          text: 'Delete for everyone',
          style: 'destructive',
          onPress: async () => {
            try {
              const messageIds = Array.from(selectedMessages);
              await Promise.all(
                messageIds.map(messageId =>
                  supabase.from('messages').delete().eq('id', messageId)
                )
              );
              setMessages((prev) => prev.filter((m) => !selectedMessages.has(m.id)));
              setSelectedMessages(new Set());
              setIsSelectionMode(false);
            } catch (error) {
              console.error('Error deleting messages:', error);
              Alert.alert('Error', 'Failed to delete messages');
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
      >
        <FlatList
          ref={flatListRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          data={messages}
          extraData={currentUserId}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={true}
          removeClippedSubviews={false}
          initialNumToRender={20}
          maxToRenderPerBatch={10}
          windowSize={10}
          onScrollBeginDrag={() => {
            setIsUserScrolling(true);
            setShouldAutoScroll(false);
          }}
          onScrollEndDrag={() => {
            setTimeout(() => setIsUserScrolling(false), 2000);
          }}
          onMomentumScrollBegin={() => setIsUserScrolling(true)}
          onMomentumScrollEnd={() => {
            setTimeout(() => setIsUserScrolling(false), 2000);
          }}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            const isAtBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 50;
            if (isAtBottom) {
              setShouldAutoScroll(true);
            }
          }}
          renderItem={({ item: message }) => {
            const isMe = message.author_id === currentUserId;
            const isImage = message.message_type === 'image';
            const isVoice = message.message_type === 'voice';
            const isVideo = message.message_type === 'video';
            const isSelected = selectedMessages.has(message.id);
            
            return (
              <View key={message.id} style={styles.messageRow}>
                {isSelectionMode && (
                  <TouchableOpacity
                    style={styles.checkboxLeft}
                    onPress={() => toggleMessageSelection(message.id)}
                  >
                    <Text style={[styles.checkboxText, { color: isSelected ? theme.primary : theme.textSecondary }]}>
                      {isSelected ? '☑️' : '☐'}
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={[
                  styles.messageContainer,
                  !isMe && styles.messageContainerThem
                ]}>
                  <TouchableOpacity
                  onLongPress={isSelectionMode ? () => toggleMessageSelection(message.id) : () => deleteMessage(message.id, isMe)}
                  style={[
                    styles.msg, 
                    isMe ? styles.msgMe : styles.msgThem, 
                    { backgroundColor: isMe ? theme.primaryLight : theme.surface },
                    isSelected && { backgroundColor: theme.primary + '20' }
                  ]}
                >
                {isImage && message.image_url ? (
                  <View>
                    <Image
                      source={{ uri: message.image_url }}
                      style={[
                        styles.imageMessage,
                        {
                          aspectRatio: message.image_width && message.image_height 
                            ? message.image_width / message.image_height 
                            : 1
                        }
                      ]}
                      resizeMode="cover"
                    />
                    <Text style={[styles.imageCaption, { color: isMe ? 'white' : theme.text }]}>
                      {message.content}
                    </Text>
                    <Text style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                      {formatTime(message.created_at)}
                    </Text>
                  </View>
                ) : isVoice && message.voice_url ? (
                  <View>
                    <TouchableOpacity
                      style={[
                        styles.voiceMessage,
                        playingAudio === message.id && { backgroundColor: 'rgba(0,0,0,0.2)' }
                      ]}
                      onPress={isSelectionMode ? () => toggleMessageSelection(message.id) : () => playVoiceMessage(message.voice_url, message.id)}
                      onLongPress={() => toggleMessageSelection(message.id)}
                    >
                      <Ionicons 
                        name={playingAudio === message.id ? 'pause' : 'play'} 
                        size={20} 
                        color={isMe ? 'white' : theme.text} 
                      />
                      <View style={styles.voiceInfo}>
                        <Text style={[styles.voiceDuration, { color: isMe ? 'white' : theme.text }]}>
                          {message.voice_duration}s {playingAudio === message.id ? '(playing)' : ''}
                        </Text>
                        <View style={[styles.voiceWaveform, { backgroundColor: isMe ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.1)' }]}>
                          <View style={[
                            styles.voiceBar, 
                            { backgroundColor: playingAudio === message.id ? theme.primary : (isMe ? 'white' : theme.text) }
                          ]} />
                          <View style={[
                            styles.voiceBar, 
                            styles.voiceBar2, 
                            { backgroundColor: playingAudio === message.id ? theme.primary : (isMe ? 'white' : theme.text) }
                          ]} />
                          <View style={[
                            styles.voiceBar, 
                            styles.voiceBar3, 
                            { backgroundColor: playingAudio === message.id ? theme.primary : (isMe ? 'white' : theme.text) }
                          ]} />
                          <View style={[
                            styles.voiceBar, 
                            styles.voiceBar4, 
                            { backgroundColor: playingAudio === message.id ? theme.primary : (isMe ? 'white' : theme.text) }
                          ]} />
                        </View>
                      </View>
                    </TouchableOpacity>
                    <Text style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                      {formatTime(message.created_at)}
                    </Text>
                  </View>
                ) : isVideo && message.video_url ? (
                  <View>
                    <TouchableOpacity 
                      onPress={isSelectionMode ? () => toggleMessageSelection(message.id) : undefined}
                      onLongPress={() => toggleMessageSelection(message.id)}
                    >
                      <Video
                        source={{ uri: message.video_url }}
                        style={styles.videoMessage}
                        useNativeControls
                        resizeMode="contain"
                        shouldPlay={false}
                      />
                      <Text style={[styles.videoCaption, { color: isMe ? 'white' : theme.text }]}>
                        {message.content}
                      </Text>
                    </TouchableOpacity>
                    <Text style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                      {formatTime(message.created_at)}
                    </Text>
                  </View>
                ) : (
                  <View>
                    <Text style={[isMe ? styles.textMe : styles.textThem, { color: isMe ? 'white' : theme.text }]}>
                      {message.content}
                    </Text>
                    <Text style={[styles.messageTime, { color: isMe ? 'rgba(255,255,255,0.7)' : theme.textSecondary }]}>
                      {formatTime(message.created_at)}
                    </Text>
                  </View>
                )}
                </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
        {!isSelectionMode && (
          <View style={[styles.inputBar, { backgroundColor: theme.background, borderTopColor: theme.border }]}>
            <View style={styles.inputRow}>
              <TouchableOpacity
                onPress={showMediaPicker}
                disabled={uploading || isRecording}
                style={[styles.iconButton, { backgroundColor: theme.surface }]}
              >
                <Ionicons name="attach" size={20} color={theme.primary} />
              </TouchableOpacity>
              
              {isRecording ? (
                <TouchableOpacity
                  onPress={stopRecording}
                  style={[styles.recordingButton, { backgroundColor: theme.error }]}
                >
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>
                    ⏹️ Stop ({recordingDuration}s)
                  </Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    onPress={startRecording}
                    disabled={uploading}
                    style={[styles.iconButton, { backgroundColor: theme.surface }]}
                  >
                    <Ionicons name="mic" size={20} color={theme.primary} />
                  </TouchableOpacity>
                  
                  <TextInput
                    placeholder="Message"
                    placeholderTextColor={theme.textSecondary}
                    value={text}
                    onChangeText={setText}
                    returnKeyType="send"
                    onSubmitEditing={send}
                    style={[styles.input, { 
                      color: theme.text, 
                      backgroundColor: theme.surface,
                      borderColor: theme.border 
                    }]}
                  />
                  
                  <TouchableOpacity
                    onPress={send}
                    disabled={uploading || !text.trim()}
                    style={[
                      styles.iconButton, 
                      { 
                        backgroundColor: (uploading || !text.trim()) ? theme.textSecondary : theme.primary,
                        opacity: (uploading || !text.trim()) ? 0.5 : 1
                      }
                    ]}
                  >
                    <Ionicons 
                      name={uploading ? 'hourglass' : 'send'} 
                      size={20} 
                      color="white" 
                    />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  list: { 
    padding: 12,
    flexGrow: 1,
  },
  messageTime: {
    fontSize: 10,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    width: '100%',
  },
  checkboxLeft: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    flex: 1,
  },
  messageContainerThem: {
    justifyContent: 'flex-start',
  },
  checkboxText: {
    fontSize: 18,
  },
  msg: {
    padding: 10,
    borderRadius: 12,
    maxWidth: '80%',
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  msgThem: {
    alignSelf: 'flex-start',
    borderTopLeftRadius: 4,
  },
  msgMe: {
    alignSelf: 'flex-end',
    borderTopRightRadius: 4,
  },
  inputBar: { 
    padding: 12, 
    borderTopWidth: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    padding: 12,
    borderRadius: 22,
    borderWidth: 1,
    fontSize: 16,
  },
  recordingButton: {
    flex: 1,
    padding: 12,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageMessage: { 
    width: 200, 
    maxWidth: '100%', 
    borderRadius: 8, 
    marginBottom: 1 
  },
  imageCaption: { 
    fontSize: 12, 
    fontStyle: 'italic',
    marginTop: 1
  },
  videoMessage: { 
    width: 200, 
    maxWidth: '100%', 
    height: 150,
    borderRadius: 8, 
    marginBottom: 1 
  },
  videoCaption: { 
    fontSize: 12, 
    fontStyle: 'italic',
    marginTop: 1
  },
  voiceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.1)',
    minWidth: 120
  },
  voiceIcon: { 
    fontSize: 20, 
    marginRight: 6 
  },
  voiceInfo: { 
    flex: 1 
  },
  voiceDuration: { 
    fontSize: 12, 
    marginBottom: 1 
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 8
  },
  voiceBar: {
    width: 3,
    height: 8,
    borderRadius: 2,
    marginHorizontal: 1,
    backgroundColor: '#ccc'
  },
  voiceBar2: { height: 12 },
  voiceBar3: { height: 16 },
  voiceBar4: { height: 10 },
  textMe: { color: 'white' },
  textThem: {},
});


