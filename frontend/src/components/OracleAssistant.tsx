'use client'

import { useState, useRef, useEffect } from 'react'
import { Merriweather } from 'next/font/google'
import { Send, Bot, User, Zap, BarChart3, Cloud, Coins, Cpu, Activity, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
import { oracleApi } from '../services/oracleApi'
import { useOracleApi } from '../hooks/useOracleApi'

const merriweather = Merriweather({ 
  subsets: ['latin'],
  weight: ['300', '400', '700', '900'],
  variable: '--font-merriweather'
})

interface Message {
  id: string
  type: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const services = [
  { id: 'oracle', name: 'Oracle Assistant (Default)', icon: Bot, color: 'text-purple-400' },
  { id: 'chainlink', name: 'Chainlink Price Feed', icon: Zap, color: 'text-blue-400' },
  { id: 'coingecko', name: 'CoinGecko Data', icon: Coins, color: 'text-yellow-400' },
  { id: 'weather', name: 'Weather Oracle', icon: Cloud, color: 'text-cyan-400' },
  { id: 'ai-compute', name: '0G AI Compute', icon: Cpu, color: 'text-green-400' },
  { id: 'analytics', name: 'Analytics & Monitoring', icon: BarChart3, color: 'text-red-400' },
]

export default function OracleAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Welcome to Negravis Oracle! ✨ This is your gateway to decentralized AI services powered by 0G.AI and Fluence Network. Please select an AI agent from the dropdown above and click "Launch Agent" to begin your session.',
      timestamp: new Date()
    }
  ])
  const [inputValue, setInputValue] = useState('')
  const [selectedService, setSelectedService] = useState('oracle')
  const [isLoading, setIsLoading] = useState(false)
  const [isAgentLaunched, setIsAgentLaunched] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const {
    queryState,
    priceState,
    weatherState,
    statusState,
    getSystemStatus,
    clearErrors,
    resetStates
  } = useOracleApi()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])
  
  // Clear errors when switching services
  useEffect(() => {
    clearErrors()
  }, [selectedService, clearErrors])

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    }

    const currentInput = inputValue
    const messageId = Date.now().toString()
    
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // CRITICAL: Clear all states before each request to prevent response caching/mixing
    clearErrors()
    resetStates()

    try {
      // Call real API with unique message tracking
      const response = await generateResponse(currentInput, selectedService, messageId)
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, assistantMessage])
    } catch (error: unknown) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: `❌ Error: ${error instanceof Error ? error.message : 'Failed to process request'}`,
        timestamp: new Date()
      }
      
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const formatQueryResponse = (data: Record<string, unknown>): string => {
    // Handle conversational AI responses
    if (data.metadata?.isConversational || data.result?.type === 'conversational') {
      return data.result.response || data.result;
    }

    if (data.result && typeof data.result === 'object') {
      // Handle system info queries
      if (data.result.available_providers) {
        return `📊 **System Information**\n\n**Available Providers:** ${data.result.total_providers}\n**System Health:** ${(data.result.system_health * 100).toFixed(0)}%\n\n**Providers:**\n${data.result.available_providers.map((p: Record<string, unknown>) => `• ${p.name} (${((p.reliability as number) * 100).toFixed(0)}% reliable)`).join('\n')}`;
      }
      
      // Handle price data
      if (data.result.symbol && data.result.price) {
        const result = data.result;
        let response = `💰 **${result.symbol} Price: $${result.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}**`;
        response += `\n📊 Confidence: ${(data.confidence * 100).toFixed(1)}%`;
        response += `\n🔗 Sources: ${data.sources.join(', ')}`;
        if (result.market_cap) {
          response += `\n📈 Market Cap: $${result.market_cap.toLocaleString()}`;
          response += `\n📊 24h Volume: $${result.volume_24h?.toLocaleString() || 'N/A'}`;
          response += `\n${result.change_24h >= 0 ? '📈' : '📉'} 24h Change: ${result.change_24h?.toFixed(2) || 'N/A'}%`;
        }
        return response;
      }
    }
    
    // Fallback JSON display
    return `✅ **Oracle Response:** ${JSON.stringify(data.result)} 📊 Confidence: ${(data.confidence * 100).toFixed(1)}% 🔗 Sources: ${data.sources.join(', ')} ⏱️ Response Time: ${data.execution_time_ms}ms 🔄 Method: ${data.consensus_method}`;
  };

  const generateResponse = async (query: string, service: string, messageId?: string): Promise<string> => {
    setConnectionStatus('connecting')
    
    // Auto-route weather queries to weather service, unless already weather service
    const lowerQuery = query.toLowerCase();
    if (service !== 'weather' && 
        (lowerQuery.includes('weather') || lowerQuery.includes('wheather') || // typo tolerance
         lowerQuery.includes('temperature') || lowerQuery.includes('forecast') || 
         lowerQuery.includes('climate'))) {
      console.log(`🌤️ Auto-routing weather query: "${query}" → weather service`);
      return generateResponse(query, 'weather', messageId);
    }
    
    try {
      switch (service) {
        case 'chainlink':
        case 'coingecko':
          // Use direct API call to avoid state caching
          try {
            const directResponse = await oracleApi.query(query);
            
            if (directResponse.success) {
              setConnectionStatus('connected')
              return formatQueryResponse(directResponse.data);
            } else {
              setConnectionStatus('connected')
              return `❌ Query failed: ${directResponse.error || 'Unknown error'}`;
            }
          } catch (apiError: unknown) {
            setConnectionStatus('connected')
            return `❌ API Error: ${apiError instanceof Error ? apiError.message : 'Unknown API error'}`;
          }
          break;
          
        case 'weather':
          // Extract location from query (with typo tolerance)
          const locationMatch = query.match(/\b(?:weather|wheather|temperature|climate)(?:\s+(?:in|at|for))?\s+([A-Za-z\s,]+)/i) || 
                              query.match(/\b(?:in|at)\s+([A-Za-z\s,]+)$/i);
          let location = 'London'; // default
          
          if (locationMatch) {
            location = locationMatch[1].trim().replace(/[,.]$/, '');
          } else if (!query.match(/weather|wheather|temperature|climate/i)) {
            // If no weather keywords, treat the whole query as location
            location = query.trim();
          }
          
          // Use direct API call to avoid state caching
          try {
            const weatherResponse = await oracleApi.getWeather(location);
            
            if (weatherResponse.success && weatherResponse.data) {
              setConnectionStatus('connected')
              const data = weatherResponse.data;
              let response = `🌤️ Weather in ${data.location}:`;
              response += `\n🌡️ Temperature: ${data.temperature}°C (feels like ${data.feels_like}°C)`;
              response += `\n💧 Humidity: ${data.humidity}%`;
              response += `\n🌬️ Wind: ${data.wind.speed} m/s`;
              response += `\n☁️ Conditions: ${data.weather.description}`;
              response += `\n📊 Confidence: ${(data.confidence * 100).toFixed(1)}%`;
              return response;
            } else {
              setConnectionStatus('connected')
              return `❌ Could not fetch weather for ${location}: ${weatherResponse.error || 'Unknown error'}`;
            }
          } catch (weatherError: unknown) {
            setConnectionStatus('connected')
            return `❌ Weather API Error: ${weatherError instanceof Error ? weatherError.message : 'Unknown weather error'}`;
          }
          break;
          
        case 'analytics':
          // Use direct API call to avoid state caching
          try {
            const statusResponse = await oracleApi.getSystemStatus();
            
            if (statusResponse.success && statusResponse.data) {
              setConnectionStatus('connected')
              const data = statusResponse.data;
              let response = `📊 System Analytics:`;
              response += `\n🔧 Providers: ${data.system.active_providers}/${data.system.total_providers} active`;
              response += `\n💚 Health: ${(data.system.system_health * 100).toFixed(1)}%`;
              response += `\n⏱️ Uptime: ${Math.floor(data.uptime / 3600)}h ${Math.floor((data.uptime % 3600) / 60)}m`;
              response += `\n🤖 Chatbots: ${data.chatbots?.active_bots || 0} active`;
              return response;
            } else {
              setConnectionStatus('connected')
              return `❌ Could not fetch system status: ${statusResponse.error || 'Unknown error'}`;
            }
          } catch (statusError: unknown) {
            setConnectionStatus('connected')
            return `❌ Status API Error: ${statusError instanceof Error ? statusError.message : 'Unknown status error'}`;
          }
          break;
          
        case 'ai-compute':
          setConnectionStatus('connected')
          return `🤖 0G AI Compute: Processing "${query}" with advanced AI models.\n\n🔗 This feature connects to decentralized AI networks for complex computations.\n⚡ Currently in beta phase - full functionality coming soon!`;
          
        default:
          // General oracle query - use direct API call to avoid state caching
          try {
            const defaultResponse = await oracleApi.query(query);
            
            if (defaultResponse.success) {
              setConnectionStatus('connected')
              return formatQueryResponse(defaultResponse.data);
            } else {
              setConnectionStatus('connected')
              return `❌ Query failed: ${defaultResponse.error || 'Unknown error'}`;
            }
          } catch (defaultError: unknown) {
            setConnectionStatus('connected')
            return `❌ Oracle API Error: ${defaultError instanceof Error ? defaultError.message : 'Unknown oracle error'}`;
          }
      }
      
      // Fallback
      setConnectionStatus('connected')
      return `❌ I couldn't process that request. Please try rephrasing your query or check if the backend service is running.`;
      
    } catch (error: unknown) {
      setConnectionStatus('connected')
      return `❌ Service error: ${error instanceof Error ? error.message : 'Unknown error occurred'}\n\n💡 Tip: Make sure the backend Oracle service is running on port 4001.`;
    }
  }

  const handleLaunchAgent = async () => {
    setIsAgentLaunched(true)
    setConnectionStatus('connecting')
    
    // Test connection by getting system status
    try {
      await getSystemStatus()
      setConnectionStatus('connected')
    } catch (error: unknown) {
      setConnectionStatus('connected')
      // Silently handle connection test error
      void error;
    }
    
    const serviceName = services.find(s => s.id === selectedService)?.name || 'Oracle Assistant'
    const welcomeMessage: Message = {
      id: (Date.now() + 2).toString(),
      type: 'assistant',
      content: `🚀 ${serviceName} activated!\n\nI'm ready to assist you with:\n• 💰 Cryptocurrency prices (BTC, ETH, etc.)\n• 🌤️ Weather data for any location\n• 📊 System analytics and health status\n• 🤖 AI-powered computations\n• 🔍 General oracle queries\n\nWhat would you like to explore?`,
      timestamp: new Date()
    }
    setMessages(prev => [...prev, welcomeMessage])
  }

  const quickActions = [
    { icon: Activity, label: 'Check Balance', action: 'check balance' },
    { icon: BarChart3, label: 'List Services', action: 'list available services' },
    { icon: Zap, label: 'Chat', action: 'start chat session' },
    { icon: Bot, label: 'Providers', action: 'show oracle providers' }
  ]

  return (
    <div className={`flex flex-col h-full bg-gray-900 text-white ${merriweather.className} relative`}>
      
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full transition-colors ${
              connectionStatus === 'connected' ? 'bg-green-400' :
              connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
              'bg-red-400'
            }`}></div>
            <h2 className="text-lg font-bold">Oracle Assistant</h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            {connectionStatus === 'connected' && <CheckCircle className="w-4 h-4 text-green-400" />}
            {connectionStatus === 'connecting' && <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />}
            {connectionStatus === 'disconnected' && <AlertCircle className="w-4 h-4 text-red-400" />}
            <span className={`capitalize ${
              connectionStatus === 'connected' ? 'text-green-400' :
              connectionStatus === 'connecting' ? 'text-yellow-400' :
              'text-red-400'
            }`}>{connectionStatus}</span>
          </div>
        </div>
        
        {/* Service Selection */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-cyan-400">Select AI Agent:</label>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-400"
          >
            {services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
          <button
            onClick={handleLaunchAgent}
            className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            {isAgentLaunched ? 'Agent Active' : 'Launch Agent'}
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-950">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              message.type === 'user' 
                ? 'bg-blue-600' 
                : 'bg-purple-600'
            }`}>
              {message.type === 'user' ? (
                <User className="w-4 h-4" />
              ) : (
                <Bot className="w-4 h-4" />
              )}
            </div>
            <div className={`max-w-[75%] rounded-lg p-3 ${
              message.type === 'user' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-800 text-gray-100'
            }`}>
              <p className="text-sm">{message.content}</p>
              <span className="text-xs text-gray-400 mt-1 block">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex gap-2 items-center">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
                <span className="text-xs text-gray-400 ml-2">
                  {connectionStatus === 'connecting' ? 'Connecting to Oracle...' : 'Processing your request...'}
                </span>
                {(queryState.loading || priceState.loading || weatherState.loading || statusState.loading) && (
                  <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                )}
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Actions */}
      <div className="px-4 py-2 border-t border-gray-800">
        <div className="flex gap-2">
          {quickActions.map((action, index) => (
            <button
              key={index}
              onClick={() => setInputValue(action.action)}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-2 px-2 rounded text-xs transition-colors flex items-center justify-center gap-1"
            >
              <action.icon className="w-3 h-3" />
              <span className="hidden sm:inline">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Ask about our API or test a service..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 focus:outline-none focus:border-cyan-400"
          />
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-700 text-white disabled:text-gray-400 p-2 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}