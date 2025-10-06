# Supabase Setup Guide for n8n Integration

## Step-by-Step Setup Instructions

### 1. Database Setup

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Click **SQL Editor** in the left sidebar

2. **Run the Schema Script**
   - Copy the entire content from `src/db/ai_agents_schema.sql`
   - Paste it in the SQL Editor
   - Click **Run** to execute

3. **Verify Tables Created**
   - Go to **Table Editor**
   - You should see these new tables:
     - `ai_agents`
     - `agent_executions` 
     - `agent_message_executions`
     - `agent_chat_participants`

### 2. Edge Function Setup

1. **Go to Edge Functions**
   - In Supabase Dashboard, click **Edge Functions**
   - Click **"Create a new function"**

2. **Create Function**
   - Name: `n8n-webhook`
   - Copy the content from `supabase/functions/n8n-webhook/index.ts`
   - Click **Deploy**

3. **Get Function URL**
   - After deployment, copy the function URL
   - It will look like: `https://your-project-ref.supabase.co/functions/v1/n8n-webhook`

### 3. Environment Variables

1. **Go to Project Settings**
   - Click **Settings** → **API**
   - Copy your **Project URL** and **anon public** key

2. **Update Your .env File**
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   ```

### 4. Test the Setup

1. **Run Test Queries**
   - Use the queries from `test-n8n-setup.js` in SQL Editor
   - Verify all tables and policies are created

2. **Test Edge Function**
   - Use a tool like Postman or curl to test:
   ```bash
   curl -X POST https://your-project-ref.supabase.co/functions/v1/n8n-webhook \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer your-anon-key" \
     -d '{"executionId":"test-123","message":"Test message"}'
   ```

### 5. Configure n8n Workflow

1. **Create n8n Workflow**
   - Use the examples from `docs/n8n-integration.md`
   - Set up webhook trigger node

2. **Get Webhook URL**
   - Copy your n8n workflow webhook URL
   - It will look like: `https://your-n8n-instance.com/webhook/your-workflow-id`

3. **Create Test Agent**
   - Open your app
   - Go to **AI Agents** screen
   - Create a new agent with your n8n workflow ID
   - Test the connection

### 6. Troubleshooting

**Common Issues:**

1. **"Table doesn't exist" error**
   - Run the schema script again
   - Check for any error messages

2. **"Function not found" error**
   - Verify the edge function is deployed
   - Check the function URL is correct

3. **"Permission denied" error**
   - Check RLS policies are created
   - Verify you're authenticated in the app

4. **"Connection test failed"**
   - Check n8n workflow is active
   - Verify webhook URL is accessible
   - Test with curl/Postman first

### 7. Security Checklist

- ✅ RLS policies enabled on all tables
- ✅ API keys stored securely
- ✅ Webhook URLs use HTTPS
- ✅ Input validation in edge function
- ✅ Error handling implemented

### 8. Next Steps

1. Create your first n8n workflow
2. Set up an AI agent in the app
3. Test end-to-end integration
4. Monitor execution logs
5. Scale up with more complex workflows

## Quick Reference

**Database Tables:**
- `ai_agents` - Stores agent configurations
- `agent_executions` - Tracks workflow executions
- `agent_message_executions` - Links messages to executions
- `agent_chat_participants` - Agent membership in chats

**Edge Function:**
- `n8n-webhook` - Handles responses from n8n

**Key URLs:**
- Supabase Dashboard: `https://supabase.com/dashboard`
- Your Project: `https://supabase.com/dashboard/project/your-project-ref`
- Edge Functions: `https://your-project-ref.supabase.co/functions/v1/`

**Test Commands:**
```bash
# Test edge function
curl -X POST https://your-project-ref.supabase.co/functions/v1/n8n-webhook \
  -H "Content-Type: application/json" \
  -d '{"executionId":"test","message":"hello"}'

# Check tables
SELECT * FROM ai_agents LIMIT 1;
```
