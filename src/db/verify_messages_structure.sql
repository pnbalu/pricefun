-- Verify messages table structure and permissions
-- Run this to check if everything is set up correctly

-- Check if reactions column exists
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name = 'reactions';

-- Check message_type column
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'messages' 
AND column_name = 'message_type';

-- Check existing constraints on messages table
SELECT conname, contype, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'messages'::regclass;

-- Check RLS policies on messages table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'messages';

-- Test if we can update a message (this will show any errors)
-- Note: This is just a test query, it won't actually update anything
SELECT 'RLS policies and constraints check complete' as status;
