-- ========================================
-- COMPLETE DATABASE SCHEMA FOR CHAT APP
-- ========================================
-- This is the single, comprehensive database setup script
-- Run this in Supabase SQL Editor to set up everything needed

-- ========================================
-- 1. CREATE TABLES AND SCHEMA
-- ========================================

-- Users are Supabase auth.users; we'll store profiles keyed by user id (phone as username)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT UNIQUE,
  display_name TEXT,
  about TEXT,
  profile_photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- One-to-one or group chats with full group support
CREATE TABLE IF NOT EXISTS chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group BOOLEAN DEFAULT FALSE,
  group_name TEXT,
  group_description TEXT,
  group_photo_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Participants with role support for group management
CREATE TABLE IF NOT EXISTS chat_participants (
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  inserted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (chat_id, user_id)
);

-- Messages with full media support and reactions
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'voice', 'video', 'system')),
  image_url TEXT,
  image_width INTEGER,
  image_height INTEGER,
  voice_url TEXT,
  voice_duration INTEGER,
  video_url TEXT,
  video_duration INTEGER,
  reactions TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Per-user hides (delete for me)
CREATE TABLE IF NOT EXISTS message_hides (
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

-- ========================================
-- 2. CREATE VIEWS
-- ========================================

-- Enhanced view for chat list items with group support
CREATE OR REPLACE VIEW chats_view AS
WITH me AS (
  SELECT auth.uid() AS id
)
SELECT
  c.id,
  CASE
    WHEN c.is_group THEN COALESCE(c.group_name, 'Group Chat')
    ELSE COALESCE(other_p.display_name, other_p.phone, 'Chat')
  END AS title,
  (SELECT m.content FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
  (SELECT m.created_at FROM messages m WHERE m.chat_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS updated_at,
  (
    SELECT COUNT(*) FROM messages m
    JOIN me ON true
    WHERE m.chat_id = c.id
      AND m.author_id <> me.id
      AND m.created_at > COALESCE(
        (SELECT cp.last_read_at FROM chat_participants cp 
         WHERE cp.chat_id = c.id AND cp.user_id = me.id), 
        '1900-01-01'::timestamp
      )
  ) AS unread_count
FROM chats c
JOIN chat_participants cp ON c.id = cp.chat_id
JOIN me ON cp.user_id = me.id
LEFT JOIN chat_participants other_cp ON c.id = other_cp.chat_id AND other_cp.user_id != me.id
LEFT JOIN profiles other_p ON other_cp.user_id = other_p.id
WHERE NOT EXISTS (
  SELECT 1 FROM message_hides mh 
  WHERE mh.message_id = (
    SELECT m.id FROM messages m 
    WHERE m.chat_id = c.id 
    ORDER BY m.created_at DESC LIMIT 1
  ) AND mh.user_id = me.id
)
ORDER BY updated_at DESC NULLS LAST;

-- ========================================
-- 3. ENABLE ROW LEVEL SECURITY
-- ========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_hides ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 4. CREATE RLS POLICIES
-- ========================================

-- Profiles policies
DROP POLICY IF EXISTS "profiles self select" ON profiles;
DROP POLICY IF EXISTS "profiles self insert" ON profiles;
DROP POLICY IF EXISTS "profiles self update" ON profiles;
CREATE POLICY "profiles self select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles self insert" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles self update" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Chats policies
DROP POLICY IF EXISTS "chat members can view chat" ON chats;
DROP POLICY IF EXISTS "users can create chats" ON chats;
DROP POLICY IF EXISTS "chat creators can update chats" ON chats;
CREATE POLICY "chat members can view chat" ON chats FOR SELECT USING (
  EXISTS(SELECT 1 FROM chat_participants cp WHERE cp.chat_id = chats.id AND cp.user_id = auth.uid())
);
CREATE POLICY "users can create chats" ON chats FOR INSERT 
WITH CHECK (auth.uid() = created_by OR created_by IS NULL);
CREATE POLICY "chat creators can update chats" ON chats FOR UPDATE 
USING (auth.uid() = created_by OR created_by IS NULL)
WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

-- Chat participants policies
DROP POLICY IF EXISTS "chat participants visible to authed" ON chat_participants;
DROP POLICY IF EXISTS "chat participants update self" ON chat_participants;
DROP POLICY IF EXISTS "users can add chat participants" ON chat_participants;
DROP POLICY IF EXISTS "users can remove chat participants" ON chat_participants;
CREATE POLICY "chat participants visible to authed" ON chat_participants
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "chat participants update self" ON chat_participants
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "users can add chat participants" ON chat_participants FOR INSERT 
WITH CHECK (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM chat_participants cp 
    JOIN chats c ON cp.chat_id = c.id 
    WHERE cp.chat_id = chat_participants.chat_id 
    AND cp.user_id = auth.uid() 
    AND cp.role = 'admin'
  ) OR
  EXISTS (
    SELECT 1 FROM chats c 
    WHERE c.id = chat_participants.chat_id 
    AND c.created_by = auth.uid()
  )
);
CREATE POLICY "users can remove chat participants" ON chat_participants FOR DELETE 
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM chat_participants cp 
    WHERE cp.chat_id = chat_participants.chat_id 
    AND cp.user_id = auth.uid() 
    AND cp.role = 'admin'
  ) OR
  EXISTS (
    SELECT 1 FROM chats c 
    WHERE c.id = chat_participants.chat_id 
    AND c.created_by = auth.uid()
  )
);

-- Messages policies
DROP POLICY IF EXISTS "messages readable by author or chat members" ON messages;
DROP POLICY IF EXISTS "messages insert by self" ON messages;
DROP POLICY IF EXISTS "messages delete by author" ON messages;
DROP POLICY IF EXISTS "messages update by author" ON messages;
DROP POLICY IF EXISTS "messages update by chat members" ON messages;
CREATE POLICY "messages readable by author or chat members" ON messages FOR SELECT USING (
  author_id = auth.uid() OR EXISTS(SELECT 1 FROM chat_participants cp WHERE cp.chat_id = messages.chat_id AND cp.user_id = auth.uid())
);
CREATE POLICY "messages insert by self" ON messages FOR INSERT WITH CHECK (author_id = auth.uid());
CREATE POLICY "messages delete by author" ON messages FOR DELETE USING (author_id = auth.uid());
CREATE POLICY "messages update by author" ON messages 
FOR UPDATE USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());
CREATE POLICY "messages update by chat members" ON messages 
FOR UPDATE USING (
  EXISTS(SELECT 1 FROM chat_participants cp WHERE cp.chat_id = messages.chat_id AND cp.user_id = auth.uid())
) WITH CHECK (
  EXISTS(SELECT 1 FROM chat_participants cp WHERE cp.chat_id = messages.chat_id AND cp.user_id = auth.uid())
);

-- Message hides policies
DROP POLICY IF EXISTS "message_hides select self" ON message_hides;
DROP POLICY IF EXISTS "message_hides insert self" ON message_hides;
CREATE POLICY "message_hides select self" ON message_hides FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "message_hides insert self" ON message_hides FOR INSERT WITH CHECK (user_id = auth.uid());

-- ========================================
-- 5. CREATE STORAGE BUCKETS
-- ========================================

-- Create storage buckets for media files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('chat_media', 'chat_media', true, 104857600, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'audio/m4a', 'audio/mp3', 'audio/wav', 'video/mp4', 'video/quicktime', 'video/x-msvideo']),
  ('profile_photos', 'profile_photos', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- 6. CREATE STORAGE RLS POLICIES
-- ========================================

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing storage policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can upload chat media" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update chat media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete chat media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete profile photos" ON storage.objects;

-- Chat Media Storage Policies (unified bucket)
CREATE POLICY "Users can upload chat media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat_media');

CREATE POLICY "Users can view chat media" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat_media');

CREATE POLICY "Users can update chat media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'chat_media');

CREATE POLICY "Users can delete chat media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat_media');

-- Profile Photos Storage Policies
CREATE POLICY "Users can upload profile photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile_photos');

CREATE POLICY "Users can view profile photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'profile_photos');

CREATE POLICY "Users can update profile photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'profile_photos');

CREATE POLICY "Users can delete profile photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'profile_photos');

-- ========================================
-- 7. CREATE HELPER FUNCTIONS
-- ========================================

-- Helper RPC to get or create a direct chat by phone, ensures membership
CREATE OR REPLACE FUNCTION get_or_create_direct_chat_by_phone(target_phone TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  other_user_id UUID;
  direct_chat_id UUID;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT id INTO other_user_id FROM profiles WHERE phone = target_phone;
  IF other_user_id IS NULL THEN
    RAISE EXCEPTION 'user with phone % not found', target_phone;
  END IF;
  IF other_user_id = current_user_id THEN
    RAISE EXCEPTION 'cannot chat with yourself';
  END IF;

  -- check existing direct chat between the two
  SELECT c.id INTO direct_chat_id
  FROM chats c
  JOIN chat_participants a ON a.chat_id = c.id AND a.user_id = current_user_id
  JOIN chat_participants b ON b.chat_id = c.id AND b.user_id = other_user_id
  WHERE c.is_group = FALSE
  LIMIT 1;

  IF direct_chat_id IS NULL THEN
    INSERT INTO chats(is_group) VALUES(FALSE) RETURNING id INTO direct_chat_id;
    INSERT INTO chat_participants(chat_id, user_id) VALUES (direct_chat_id, current_user_id), (direct_chat_id, other_user_id);
  END IF;

  RETURN direct_chat_id;
END;
$$;

-- ========================================
-- 8. CREATE INDEXES FOR PERFORMANCE
-- ========================================

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone);
CREATE INDEX IF NOT EXISTS idx_chats_is_group ON chats(is_group);
CREATE INDEX IF NOT EXISTS idx_chats_created_by ON chats(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id ON chat_participants(chat_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_role ON chat_participants(role);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_author_id ON messages(author_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_message_hides_message_id ON message_hides(message_id);
CREATE INDEX IF NOT EXISTS idx_message_hides_user_id ON message_hides(user_id);

-- ========================================
-- SETUP COMPLETE
-- ========================================

-- This comprehensive script sets up:
-- ✅ All database tables with full group chat support
-- ✅ Enhanced views for chat lists with unread counts
-- ✅ Complete Row Level Security policies
-- ✅ Unified storage bucket for all media types
-- ✅ Storage RLS policies for file uploads
-- ✅ Helper functions for chat creation
-- ✅ Full media support (images, voice, video)
-- ✅ Profile photos and about sections
-- ✅ Message reactions and system messages
-- ✅ Performance indexes
-- ✅ Group management (admin/member roles)

-- After running this script, your WhatsApp-like chat app will be fully configured!
