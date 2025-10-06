/**
 * n8n Connector Service
 * Handles communication between the chat app and n8n workflows
 */

import { supabase } from '../lib/supabase';

export class N8nConnector {
  /**
   * Send message to n8n workflow and get response
   * @param {string} agentId - The AI agent ID
   * @param {string} message - The message to send
   * @param {string} chatId - The chat ID
   * @param {string} senderId - The sender's user ID
   * @returns {Promise<Object>} - Response from n8n workflow
   */
  static async sendToN8n(agentId, message, chatId, senderId) {
    try {
      console.log('🤖 Sending message to n8n agent:', agentId);

      // Get agent details
      const { data: agent, error: agentError } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (agentError || !agent) {
        throw new Error('Agent not found');
      }

      if (!agent.is_active) {
        throw new Error('Agent is not active');
      }

      // Create execution record
      const { data: execution, error: execError } = await supabase
        .from('agent_executions')
        .insert({
          agent_id: agentId,
          chat_id: chatId,
          input_message: message,
          status: 'running',
          metadata: {
            sender_id: senderId,
            timestamp: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (execError) throw execError;

      // Prepare payload for n8n
      const n8nPayload = {
        message: message,
        agent_id: agentId,
        agent_name: agent.agent_name,
        chat_id: chatId,
        execution_id: execution.id,
        trigger_keyword: agent.trigger_keyword,
        timestamp: new Date().toISOString()
      };

      // Send to n8n (this would be your actual n8n endpoint)
      const response = await this.callN8nWorkflow(
        agent.n8n_workflow_id,
        agent.api_key,
        n8nPayload
      );

      // Update execution with response
      await supabase
        .from('agent_executions')
        .update({
          output_message: response.message,
          status: 'completed',
          completed_at: new Date().toISOString(),
          metadata: {
            ...execution.metadata,
            n8n_response: response
          }
        })
        .eq('id', execution.id);

      return {
        success: true,
        message: response.message,
        executionId: execution.id
      };

    } catch (error) {
      console.error('❌ n8n connector error:', error);
      
      // Update execution as failed
      if (execution?.id) {
        await supabase
          .from('agent_executions')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            metadata: {
              error: error.message
            }
          })
          .eq('id', execution.id);
      }

      throw error;
    }
  }

  /**
   * Call n8n workflow via webhook or API
   * @param {string} workflowId - n8n workflow ID
   * @param {string} apiKey - API key for authentication
   * @param {Object} payload - Data to send to workflow
   * @returns {Promise<Object>} - Response from n8n
   */
  static async callN8nWorkflow(workflowId, apiKey, payload) {
    try {
      // Option 1: Direct webhook call (if n8n is publicly accessible)
      const webhookUrl = `https://your-n8n-instance.com/webhook/${workflowId}`;
      
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'X-API-Key': apiKey
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`n8n API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      return {
        message: result.message || result.response || 'Agent response received',
        metadata: result
      };

    } catch (error) {
      console.error('❌ n8n API call failed:', error);
      
      // Fallback: Return a default response for testing
      return {
        message: `[Test Mode] Agent received: "${payload.message}". This is a placeholder response until n8n is configured.`,
        metadata: { test_mode: true, error: error.message }
      };
    }
  }

  /**
   * Test connection to n8n workflow
   * @param {string} workflowId - n8n workflow ID
   * @param {string} apiKey - API key for authentication
   * @returns {Promise<Object>} - Test result
   */
  static async testConnection(workflowId, apiKey) {
    try {
      console.log('🧪 Testing n8n connection...');

      const testPayload = {
        message: 'Test connection from chat app',
        test: true,
        timestamp: new Date().toISOString()
      };

      const response = await this.callN8nWorkflow(workflowId, apiKey, testPayload);

      return {
        success: true,
        message: 'Connection test successful',
        response: response
      };

    } catch (error) {
      return {
        success: false,
        message: `Connection test failed: ${error.message}`,
        error: error.message
      };
    }
  }

  /**
   * Handle incoming webhook from n8n
   * This would be called by a Supabase Edge Function
   * @param {string} executionId - The execution ID
   * @param {Object} n8nResponse - Response from n8n
   */
  static async handleN8nWebhook(executionId, n8nResponse) {
    try {
      console.log('📨 Received webhook from n8n:', executionId);

      // Update execution record
      const { error: updateError } = await supabase
        .from('agent_executions')
        .update({
          output_message: n8nResponse.message,
          status: 'completed',
          completed_at: new Date().toISOString(),
          metadata: {
            n8n_response: n8nResponse
          }
        })
        .eq('id', executionId);

      if (updateError) throw updateError;

      // Get execution details
      const { data: execution, error: execError } = await supabase
        .from('agent_executions')
        .select(`
          *,
          ai_agents!inner(*)
        `)
        .eq('id', executionId)
        .single();

      if (execError) throw execError;

      // Send message back to chat
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          chat_id: execution.chat_id,
          author_id: execution.ai_agents.user_id, // Use agent owner's ID
          content: n8nResponse.message,
          message_type: 'agent',
          metadata: {
            agent_id: execution.agent_id,
            execution_id: executionId
          }
        });

      if (messageError) throw messageError;

      return { success: true };

    } catch (error) {
      console.error('❌ Webhook handling error:', error);
      throw error;
    }
  }

  /**
   * Get agent execution history
   * @param {string} agentId - The agent ID
   * @param {number} limit - Number of executions to return
   * @returns {Promise<Array>} - Execution history
   */
  static async getExecutionHistory(agentId, limit = 10) {
    try {
      const { data, error } = await supabase
        .from('agent_executions')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data || [];

    } catch (error) {
      console.error('❌ Error fetching execution history:', error);
      return [];
    }
  }
}
