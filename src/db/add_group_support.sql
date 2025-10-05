-- Add group support to existing chats table
ALTER TABLE chats 
ADD COLUMN IF NOT EXISTS group_name text,
ADD COLUMN IF NOT EXISTS group_description text,
ADD COLUMN IF NOT EXISTS group_photo_url text,
ADD COLUMN IF NOT EXISTS created_by uuid references auth.users(id);

-- Add reactions column to messages table
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS reactions text default '';

-- Add message_type column for system messages
ALTER TABLE messages 
ADD COLUMN IF NOT EXISTS message_type text default 'text';

-- Drop and recreate the chats_view to handle group chats properly
DROP VIEW IF EXISTS chats_view;

CREATE VIEW chats_view AS
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

-- Add RLS policies for group chat support

-- Allow users to create chats (for group creation)
DROP POLICY IF EXISTS "users can create chats" ON chats;
CREATE POLICY "users can create chats" ON chats FOR INSERT 
WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

-- Allow users to update chats they created (for group management)
DROP POLICY IF EXISTS "chat creators can update chats" ON chats;
CREATE POLICY "chat creators can update chats" ON chats FOR UPDATE 
USING (auth.uid() = created_by OR created_by IS NULL)
WITH CHECK (auth.uid() = created_by OR created_by IS NULL);

-- Allow users to insert chat participants (for adding members)
DROP POLICY IF EXISTS "users can add chat participants" ON chat_participants;
CREATE POLICY "users can add chat participants" ON chat_participants FOR INSERT 
WITH CHECK (
  -- Allow if user is adding themselves
  auth.uid() = user_id OR
  -- Allow if user is admin of the chat
  EXISTS (
    SELECT 1 FROM chat_participants cp 
    JOIN chats c ON cp.chat_id = c.id 
    WHERE cp.chat_id = chat_participants.chat_id 
    AND cp.user_id = auth.uid() 
    AND cp.role = 'admin'
  ) OR
  -- Allow if user created the chat
  EXISTS (
    SELECT 1 FROM chats c 
    WHERE c.id = chat_participants.chat_id 
    AND c.created_by = auth.uid()
  )
);

-- Allow users to delete chat participants (for removing members/leaving)
DROP POLICY IF EXISTS "users can remove chat participants" ON chat_participants;
CREATE POLICY "users can remove chat participants" ON chat_participants FOR DELETE 
USING (
  -- Allow if user is removing themselves
  auth.uid() = user_id OR
  -- Allow if user is admin of the chat
  EXISTS (
    SELECT 1 FROM chat_participants cp 
    WHERE cp.chat_id = chat_participants.chat_id 
    AND cp.user_id = auth.uid() 
    AND cp.role = 'admin'
  ) OR
  -- Allow if user created the chat
  EXISTS (
    SELECT 1 FROM chats c 
    WHERE c.id = chat_participants.chat_id 
    AND c.created_by = auth.uid()
  )
);
