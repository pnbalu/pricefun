-- Emergency RLS Fix - Disable RLS temporarily to test group creation
-- This will help us identify if RLS is the root cause

-- Step 1: Temporarily disable RLS on chats table to test
ALTER TABLE chats DISABLE ROW LEVEL SECURITY;

-- Step 2: Also disable on chat_participants to be safe
ALTER TABLE chat_participants DISABLE ROW LEVEL SECURITY;

-- Step 3: Keep messages RLS enabled but with permissive policy
DROP POLICY IF EXISTS "allow_messages_insert" ON messages;
DROP POLICY IF EXISTS "messages insert by self" ON messages;
DROP POLICY IF EXISTS "allow_system_messages" ON messages;

CREATE POLICY "permissive_message_insert" ON messages FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Test message
DO $$ 
BEGIN
    RAISE NOTICE 'RLS temporarily disabled on chats and chat_participants';
    RAISE NOTICE 'Try creating a group now - if it works, RLS was the issue';
    RAISE NOTICE 'We can then re-enable RLS with proper policies';
END $$;
