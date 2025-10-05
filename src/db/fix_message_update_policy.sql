-- Fix missing UPDATE policy for messages table
-- This allows users to update message reactions

-- Allow message authors to update their own messages (for reactions, content, etc.)
DROP POLICY IF EXISTS "messages update by author" ON messages;
CREATE POLICY "messages update by author" ON messages 
FOR UPDATE 
USING (author_id = auth.uid()) 
WITH CHECK (author_id = auth.uid());

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Message update policy added successfully!';
    RAISE NOTICE 'Users can now update their own messages (reactions, content, etc.)';
END $$;
