-- Comprehensive fix for message reaction updates
-- This addresses both RLS policies and constraint issues

-- 1. Fix message_type constraint to allow all message types
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- Create a more permissive constraint
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check 
CHECK (message_type IN ('text', 'image', 'voice', 'video', 'system'));

-- 2. Add missing UPDATE policy for messages
DROP POLICY IF EXISTS "messages update by author" ON messages;
CREATE POLICY "messages update by author" ON messages 
FOR UPDATE 
USING (author_id = auth.uid()) 
WITH CHECK (author_id = auth.uid());

-- 3. Also allow chat members to update messages (for reactions from anyone)
-- This is more permissive and allows group members to react to any message
DROP POLICY IF EXISTS "messages update by chat members" ON messages;
CREATE POLICY "messages update by chat members" ON messages 
FOR UPDATE 
USING (
  EXISTS(
    SELECT 1 FROM chat_participants cp 
    WHERE cp.chat_id = messages.chat_id 
    AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS(
    SELECT 1 FROM chat_participants cp 
    WHERE cp.chat_id = messages.chat_id 
    AND cp.user_id = auth.uid()
  )
);

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Message reaction updates fixed successfully!';
    RAISE NOTICE 'Users can now update reactions on messages in their chats';
    RAISE NOTICE 'Message type constraint updated to allow all types';
END $$;
