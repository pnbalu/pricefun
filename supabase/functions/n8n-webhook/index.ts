/**
 * Supabase Edge Function for handling n8n webhooks
 * This function receives responses from n8n workflows and processes them
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Parse the webhook payload
    const payload = await req.json()
    console.log('📨 Received n8n webhook:', payload)

    // Extract execution ID from the payload
    const { executionId, message, metadata } = payload

    if (!executionId) {
      throw new Error('executionId is required')
    }

    // Update the execution record
    const { error: updateError } = await supabaseClient
      .from('agent_executions')
      .update({
        output_message: message || 'Response received from n8n',
        status: 'completed',
        completed_at: new Date().toISOString(),
        metadata: {
          n8n_response: payload,
          webhook_received_at: new Date().toISOString()
        }
      })
      .eq('id', executionId)

    if (updateError) {
      console.error('❌ Error updating execution:', updateError)
      throw updateError
    }

    // Get execution details to find the chat
    const { data: execution, error: execError } = await supabaseClient
      .from('agent_executions')
      .select(`
        *,
        ai_agents!inner(
          user_id,
          agent_name,
          chat_id
        )
      `)
      .eq('id', executionId)
      .single()

    if (execError) {
      console.error('❌ Error fetching execution:', execError)
      throw execError
    }

    // Send the response message back to the chat
    const { error: messageError } = await supabaseClient
      .from('messages')
      .insert({
        chat_id: execution.chat_id,
        author_id: execution.ai_agents.user_id, // Use agent owner's ID
        content: message || 'Agent response received',
        message_type: 'agent',
        metadata: {
          agent_id: execution.agent_id,
          agent_name: execution.ai_agents.agent_name,
          execution_id: executionId,
          n8n_webhook: true
        }
      })

    if (messageError) {
      console.error('❌ Error inserting message:', messageError)
      throw messageError
    }

    console.log('✅ Successfully processed n8n webhook for execution:', executionId)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed successfully',
        executionId: executionId
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('❌ Webhook processing error:', error)

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
