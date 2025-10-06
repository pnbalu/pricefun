-- ========================================
-- SEED DATA FOR TESTING
-- ========================================
-- Optional: Add sample data for testing
-- Run this AFTER complete_schema.sql

-- Note: This is optional seed data for testing purposes
-- In production, users will create their own profiles through the app

-- Example: Create sample profiles (replace with actual phone numbers)
-- INSERT INTO profiles (id, phone, display_name, about) VALUES
--   ('00000000-0000-0000-0000-000000000001', '+1234567890', 'Test User 1', 'Hello, I am a test user!'),
--   ('00000000-0000-0000-0000-000000000002', '+1234567891', 'Test User 2', 'Another test user for testing chats');

-- Example: Create a sample group chat
-- INSERT INTO chats (id, is_group, group_name, group_description, created_by) VALUES
--   ('00000000-0000-0000-0000-000000000001', true, 'Test Group', 'A test group for development', '00000000-0000-0000-0000-000000000001');

-- Example: Add participants to the group
-- INSERT INTO chat_participants (chat_id, user_id, role) VALUES
--   ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'admin'),
--   ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'member');

-- Example: Add sample messages
-- INSERT INTO messages (chat_id, author_id, content, message_type) VALUES
--   ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Welcome to the test group!', 'system'),
--   ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Hello everyone!', 'text'),
--   ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'Hi there! 👋', 'text');

-- To use this seed data:
-- 1. Uncomment the INSERT statements above
-- 2. Replace the UUIDs with actual user IDs from your auth.users table
-- 3. Replace phone numbers with valid test numbers
-- 4. Run this script after complete_schema.sql

-- For production, DO NOT run this seed data script
-- Let users create their own profiles and chats through the app
