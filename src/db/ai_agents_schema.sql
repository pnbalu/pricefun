-- AI Agents Database Schema
-- This script creates all necessary tables for AI agent management

-- AI Agents table
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  agent_description TEXT,
  avatar_url TEXT,
  n8n_workflow_id TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  trigger_keyword TEXT, -- Optional keyword to trigger this agent
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Agent executions tracking
CREATE TABLE IF NOT EXISTS agent_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  execution_id TEXT, -- n8n execution ID
  status TEXT DEFAULT 'running', -- running, completed, failed
  input_message TEXT,
  output_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Link messages to agent executions
CREATE TABLE IF NOT EXISTS agent_message_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  execution_id UUID REFERENCES agent_executions(id) ON DELETE CASCADE,
  direction TEXT CHECK (direction IN ('trigger', 'response')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Agent chat participants (agents can be added to groups)
CREATE TABLE IF NOT EXISTS agent_chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(agent_id, chat_id)
);

-- Update existing chat_participants to handle agents
ALTER TABLE chat_participants ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES ai_agents(id);
ALTER TABLE chat_participants DROP CONSTRAINT IF EXISTS check_participant_type;
ALTER TABLE chat_participants ADD CONSTRAINT check_participant_type 
  CHECK ((user_id IS NOT NULL AND agent_id IS NULL) OR (user_id IS NULL AND agent_id IS NOT NULL));

-- RLS Policies for AI Agents
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_message_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_chat_participants ENABLE ROW LEVEL SECURITY;

-- Policies for ai_agents
CREATE POLICY "Users can view their own agents" ON ai_agents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agents" ON ai_agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agents" ON ai_agents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agents" ON ai_agents
  FOR DELETE USING (auth.uid() = user_id);

-- Policies for agent_executions
CREATE POLICY "Users can view agent executions for their agents" ON agent_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_executions.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert agent executions for their agents" ON agent_executions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_executions.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update agent executions for their agents" ON agent_executions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM ai_agents 
      WHERE ai_agents.id = agent_executions.agent_id 
      AND ai_agents.user_id = auth.uid()
    )
  );

-- Policies for agent_message_executions
CREATE POLICY "Users can view agent message executions for their agents" ON agent_message_executions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM agent_executions ae
      JOIN ai_agents aa ON aa.id = ae.agent_id
      WHERE ae.id = agent_message_executions.execution_id 
      AND aa.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert agent message executions for their agents" ON agent_message_executions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM agent_executions ae
      JOIN ai_agents aa ON aa.id = ae.agent_id
      WHERE ae.id = agent_message_executions.execution_id 
      AND aa.user_id = auth.uid()
    )
  );

-- Policies for agent_chat_participants
CREATE POLICY "Users can view agent chat participants for their chats" ON agent_chat_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.chat_id = agent_chat_participants.chat_id
      AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add agents to their chats" ON agent_chat_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.chat_id = agent_chat_participants.chat_id
      AND cp.user_id = auth.uid()
    ) AND
    EXISTS (
      SELECT 1 FROM ai_agents aa
      WHERE aa.id = agent_chat_participants.agent_id
      AND aa.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove agents from their chats" ON agent_chat_participants
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM chat_participants cp
      WHERE cp.chat_id = agent_chat_participants.chat_id
      AND cp.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_ai_agents_user_id ON ai_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_agents_active ON ai_agents(is_active);
CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_id ON agent_executions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_chat_id ON agent_executions(chat_id);
CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);
CREATE INDEX IF NOT EXISTS idx_agent_chat_participants_agent_id ON agent_chat_participants(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_chat_participants_chat_id ON agent_chat_participants(chat_id);

-- Success message
DO $$ 
BEGIN
    RAISE NOTICE 'AI Agents database schema created successfully!';
    RAISE NOTICE 'Tables created: ai_agents, agent_executions, agent_message_executions, agent_chat_participants';
    RAISE NOTICE 'RLS policies and indexes added';
END $$;
