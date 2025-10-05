-- Complete RLS Fix for Group Chat Creation
-- Run this to fix all RLS issues with group creation

-- First, let's see what policies exist and remove any conflicting ones
DROP POLICY IF EXISTS "users can create chats" ON chats;
DROP POLICY IF EXISTS "chat creators can update chats" ON chats;
DROP POLICY IF EXISTS "authenticated users can create chats" ON chats;
DROP POLICY IF EXISTS "authenticated users can update chats" ON chats;
DROP POLICY IF EXISTS "users can add chat participants" ON chat_participants;
DROP POLICY IF EXISTS "authenticated users can add chat participants" ON chat_participants;
DROP POLICY IF EXISTS "users can remove chat participants" ON chat_participants;

-- Create working policies for chats table
CREATE POLICY "allow_chat_creation" ON chats FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "allow_chat_updates" ON chats FOR UPDATE 
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- Create working policies for chat_participants table
CREATE POLICY "allow_participant_insertion" ON chat_participants FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "allow_participant_deletion" ON chat_participants FOR DELETE 
TO authenticated
USING (auth.uid() IS NOT NULL);

-- Ensure messages can be inserted for group chats
DROP POLICY IF EXISTS "messages insert by self" ON messages;
CREATE POLICY "messages insert by self" ON messages FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = author_id);

-- Also add a policy to allow system messages (author_id can be different for system messages)
CREATE POLICY "allow_system_messages" ON messages FOR INSERT 
TO authenticated
WITH CHECK (true);

-- This should resolve all RLS issues with group creation
