-- Fix message_type constraint to allow system messages
-- Run this to fix the message_type check constraint error

-- First, drop the existing constraint
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_message_type_check;

-- Create a new constraint that includes 'system' as a valid message type
ALTER TABLE messages ADD CONSTRAINT messages_message_type_check 
CHECK (message_type IN ('text', 'image', 'voice', 'video', 'system'));

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'Message type constraint updated to include system messages';
    RAISE NOTICE 'Group creation should now work properly!';
END $$;
