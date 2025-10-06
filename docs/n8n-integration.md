# n8n Integration Guide

This guide explains how to connect your AI agents to n8n workflows for automation.

## Architecture Overview

```
Mobile App → Supabase Edge Function → n8n Workflow → Response → Mobile App
```

## Setup Steps

### 1. Create n8n Workflow

Create a workflow in n8n with the following structure:

```
Webhook Node → Process Message → Send Response
```

**Webhook Node Configuration:**
- Method: POST
- Path: `/chat-agent`
- Response Mode: "On Received"

**Example Workflow:**
1. **Webhook Trigger** - Receives messages from chat app
2. **Switch Node** - Routes based on message content or trigger keyword
3. **HTTP Request** - Call external APIs if needed
4. **Code Node** - Process and format response
5. **Respond to Webhook** - Send response back

### 2. Configure Agent in App

1. Go to **AI Agents** screen
2. Tap **"+"** to create new agent
3. Fill in the form:
   - **Agent Name**: e.g., "Customer Support Bot"
   - **Description**: e.g., "Handles customer inquiries"
   - **n8n Workflow ID**: Your workflow ID from n8n
   - **Trigger Keyword**: Optional keyword to activate agent (e.g., "support")
4. Upload avatar (optional)
5. Tap **"Test Connection"** to verify setup
6. Tap **"Create Agent"**

### 3. Add Agent to Chat

**Individual Chat:**
- Agents can be added to individual chats through the chat settings

**Group Chat:**
1. Create or edit a group
2. Scroll to **"Add AI Agents"** section
3. Select agents to add
4. Tap **"Create Group"** or **"Update Group"**

## n8n Workflow Examples

### Example 1: Simple Echo Bot

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "chat-agent",
        "responseMode": "onReceived"
      }
    },
    {
      "name": "Process Message",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "// Get the incoming message\nconst message = $input.first().json.message;\nconst agentName = $input.first().json.agent_name;\n\n// Simple echo response\nconst response = `Hello! I'm ${agentName}. You said: "${message}". How can I help you today?`;\n\nreturn {\n  message: response,\n  timestamp: new Date().toISOString()\n};"
      }
    },
    {
      "name": "Respond",
      "type": "n8n-nodes-base.respondToWebhook",
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { \"message\": $json.message, \"executionId\": $input.first().json.execution_id } }}"
      }
    }
  ]
}
```

### Example 2: Weather Bot

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "httpMethod": "POST",
        "path": "weather-bot"
      }
    },
    {
      "name": "Extract Location",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "const message = $input.first().json.message.toLowerCase();\nconst locationMatch = message.match(/weather in ([a-zA-Z\\s]+)/);\nconst location = locationMatch ? locationMatch[1].trim() : 'London';\n\nreturn { location };"
      }
    },
    {
      "name": "Get Weather",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "url": "https://api.openweathermap.org/data/2.5/weather",
        "method": "GET",
        "qs": {
          "q": "={{ $json.location }}",
          "appid": "YOUR_API_KEY",
          "units": "metric"
        }
      }
    },
    {
      "name": "Format Response",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "const weather = $input.first().json;\nconst temp = Math.round(weather.main.temp);\nconst description = weather.weather[0].description;\n\nconst response = `Current weather in ${weather.name}: ${temp}°C, ${description}`;\n\nreturn { message: response };"
      }
    },
    {
      "name": "Respond",
      "type": "n8n-nodes-base.respondToWebhook",
      "parameters": {
        "respondWith": "json",
        "responseBody": "={{ { \"message\": $json.message } }}"
      }
    }
  ]
}
```

## Message Format

### Incoming Message (from Chat App to n8n)

```json
{
  "message": "What's the weather like?",
  "agent_id": "agent-uuid",
  "agent_name": "Weather Bot",
  "chat_id": "chat-uuid",
  "execution_id": "execution-uuid",
  "trigger_keyword": "weather",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Outgoing Response (from n8n to Chat App)

```json
{
  "message": "The current weather is sunny with 22°C",
  "executionId": "execution-uuid",
  "metadata": {
    "weather_data": {...},
    "timestamp": "2024-01-01T12:00:01Z"
  }
}
```

## Testing Your Integration

### 1. Test Connection

Use the **"Test Connection"** button in the agent creation form to verify:
- n8n workflow is accessible
- Authentication is working
- Response format is correct

### 2. Test in Chat

1. Add agent to a chat
2. Send a message mentioning the trigger keyword
3. Verify agent responds correctly

### 3. Monitor Executions

Check the agent execution history in the app to see:
- Successful executions
- Failed executions
- Response times
- Error messages

## Troubleshooting

### Common Issues

**"Connection test failed"**
- Check if n8n workflow is active
- Verify workflow ID is correct
- Ensure webhook endpoint is accessible

**"Agent not responding"**
- Check execution history for errors
- Verify n8n workflow is processing messages
- Check webhook response format

**"Authentication failed"**
- Verify API key is correct
- Check n8n workflow authentication settings

### Debug Mode

Enable debug logging in the app to see detailed information about:
- Message sending to n8n
- Webhook responses
- Execution status updates

## Security Considerations

1. **API Keys**: Store securely in Supabase
2. **Webhook URLs**: Use HTTPS endpoints
3. **Input Validation**: Validate all incoming data
4. **Rate Limiting**: Implement to prevent abuse
5. **Error Handling**: Don't expose sensitive information

## Advanced Features

### Custom Triggers

Use trigger keywords to activate specific agent behaviors:
- `@support` - Customer support mode
- `@sales` - Sales inquiry mode
- `@weather` - Weather information mode

### Multi-Step Workflows

Create complex workflows that:
- Ask follow-up questions
- Store conversation context
- Integrate with external APIs
- Send notifications

### Analytics

Track agent performance:
- Response times
- Success rates
- Popular queries
- User satisfaction

## Next Steps

1. Create your first n8n workflow
2. Set up an AI agent in the app
3. Test the integration
4. Add more complex workflows
5. Monitor and optimize performance
