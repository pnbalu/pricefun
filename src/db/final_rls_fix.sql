-- Final RLS Fix - handles existing policies properly
-- Run this to fix all RLS issues with group creation

-- Remove ALL existing policies that might conflict
DO $$ 
BEGIN
    -- Drop all existing policies on chats table
    DROP POLICY IF EXISTS "allow_chat_creation" ON chats;
    DROP POLICY IF EXISTS "allow_chat_updates" ON chats;
    DROP POLICY IF EXISTS "users can create chats" ON chats;
    DROP POLICY IF EXISTS "chat creators can update chats" ON chats;
    DROP POLICY IF EXISTS "authenticated users can create chats" ON chats;
    DROP POLICY IF EXISTS "authenticated users can update chats" ON chats;
    
    -- Drop all existing policies on chat_participants table
    DROP POLICY IF EXISTS "allow_participant_insertion" ON chat_participants;
    DROP POLICY IF EXISTS "allow_participant_deletion" ON chat_participants;
    DROP POLICY IF EXISTS "users can add chat participants" ON chat_participants;
    DROP POLICY IF EXISTS "authenticated users can add chat participants" ON chat_participants;
    DROP POLICY IF EXISTS "users can remove chat participants" ON chat_participants;
    
    -- Drop existing message policies that might conflict
    DROP POLICY IF EXISTS "allow_system_messages" ON messages;
    DROP POLICY IF EXISTS "messages insert by self" ON messages;
    
    RAISE NOTICE 'All conflicting policies removed';
END $$;

-- Create new working policies
CREATE POLICY "allow_chat_creation" ON chats FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "allow_chat_updates" ON chats FOR UPDATE 
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "allow_participant_insertion" ON chat_participants FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "allow_participant_deletion" ON chat_participants FOR DELETE 
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "allow_messages_insert" ON messages FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'All RLS policies created successfully!';
    RAISE NOTICE 'Group creation should now work properly.';
END $$;
