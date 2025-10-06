/**
 * Test script to verify n8n integration setup
 * Run this in your Supabase SQL Editor or use it as a reference
 */

// 1. Test if tables exist
const testTables = `
-- Check if AI agents tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name IN ('ai_agents', 'agent_executions', 'agent_message_executions', 'agent_chat_participants') 
    THEN '✅ Table exists'
    ELSE '❌ Table missing'
  END as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ai_agents', 'agent_executions', 'agent_message_executions', 'agent_chat_participants')
ORDER BY table_name;
`;

// 2. Test RLS policies
const testPolicies = `
-- Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  CASE 
    WHEN policyname IS NOT NULL THEN '✅ Policy exists'
    ELSE '❌ Policy missing'
  END as status
FROM pg_policies 
WHERE tablename IN ('ai_agents', 'agent_executions', 'agent_message_executions', 'agent_chat_participants')
ORDER BY tablename, policyname;
`;

// 3. Test creating a sample agent (replace with your user ID)
const createSampleAgent = `
-- Create a sample agent for testing
-- Replace 'your-user-id-here' with your actual user ID
INSERT INTO ai_agents (
  user_id,
  agent_name,
  agent_description,
  n8n_workflow_id,
  webhook_url,
  api_key,
  trigger_keyword,
  is_active
) VALUES (
  'your-user-id-here', -- Replace with your user ID
  'Test Bot',
  'A test agent for n8n integration',
  'test-workflow-123',
  'https://your-project.supabase.co/functions/v1/n8n-webhook',
  'test-api-key-123',
  'test',
  true
) RETURNING *;
`;

// 4. Test the edge function URL
const testEdgeFunction = `
-- Test if edge function is accessible
-- Replace 'your-project-ref' with your actual project reference
SELECT 'https://your-project-ref.supabase.co/functions/v1/n8n-webhook' as webhook_url;
`;

console.log('📋 Supabase Setup Test Script');
console.log('=============================');
console.log('');
console.log('1. Run this query to check tables:');
console.log(testTables);
console.log('');
console.log('2. Run this query to check policies:');
console.log(testPolicies);
console.log('');
console.log('3. Create a sample agent (replace user ID):');
console.log(createSampleAgent);
console.log('');
console.log('4. Test edge function URL:');
console.log(testEdgeFunction);
console.log('');
console.log('✅ If all queries return expected results, your setup is complete!');

// Export for use in other files
module.exports = {
  testTables,
  testPolicies,
  createSampleAgent,
  testEdgeFunction
};
