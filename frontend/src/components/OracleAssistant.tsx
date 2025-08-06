'use client'

import { useState, useRef, useEffect } from 'react'
import { Merriweather } from 'next/font/google'
import { Send, Bot, User, Zap, BarChart3, Cloud, Coins, Activity, AlertCircle, CheckCircle, Loader2 } from 'lucide-react'
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

const perspectiveOracles = [
  { 
    id: 'coingecko-oracle', 
    name: '🦎 CoinGecko', 
    icon: Coins, 
    color: 'text-yellow-400',
    providers: ['coingecko'],
    perspective: 'Crypto Market Data',
    context: 'Real-time cryptocurrency prices via CoinGecko API',
    description: 'BTC, ETH, BNB, ADA and 14+ crypto prices'
  },
  { 
    id: 'weather-oracle', 
    name: '🌤️ Weather', 
    icon: Cloud, 
    color: 'text-cyan-400',
    providers: ['weather'],
    perspective: 'Weather Data',
    context: 'Global weather and climate information',
    description: 'Temperature, humidity, forecasts for any location'
  },
  { 
    id: 'web-search-oracle', 
    name: '🔍 Web Search', 
    icon: BarChart3, 
    color: 'text-red-400',
    providers: ['web-scraping'],
    perspective: 'Web Intelligence',
    context: 'Web scraping and search results',
    description: 'News, market data, web content analysis'
  },
  { 
    id: 'chat-oracle', 
    name: '💬 Chat', 
    icon: Bot, 
    color: 'text-purple-400',
    providers: ['conversational_ai'],
    perspective: 'Conversation',
    context: 'Natural language chat and help',
    description: 'Friendly conversation, help, explanations'
  }
]

// Keep old services array for backward compatibility
const services = perspectiveOracles

export default function OracleAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Welcome to Negravis Oracle System! 🎭✨\n\n**Available Oracle Agents:**\n\n🦎 **CoinGecko** - Real-time cryptocurrency prices (BTC, ETH, BNB, ADA + 14 more)\n🌤️ **Weather** - Global weather data and forecasts for any location\n🔍 **Web Search** - Web scraping, news analysis, and search intelligence\n💬 **Chat** - Natural conversation, help, and system explanations\n\n**How to start:**\n1. Select your preferred Oracle from the dropdown above\n2. Click "Launch Agent" \n3. Start asking questions specific to that Oracle!\n\n🚀 Each Oracle specializes in different data types for focused, accurate results.',
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
    
    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    // CRITICAL: Clear all states before each request to prevent response caching/mixing
    clearErrors()
    resetStates()

    try {
      // Call real API with unique message tracking
      const response = await generateResponse(currentInput, selectedService)
      
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

  const formatQueryResponse = (data: Record<string, unknown>, perspective?: string): string => {
    // Handle conversational AI responses
    const metadata = data.metadata as Record<string, unknown> | undefined
    const result = data.result as Record<string, unknown> | undefined
    
    if (metadata?.isConversational || result?.type === 'conversational') {
      return String((result as Record<string, unknown>)?.response) || String(data.result);
    }

    if (data.result && typeof data.result === 'object') {
      // Handle price data with perspective
      const resultObj = data.result as Record<string, unknown>
      if (resultObj.symbol && resultObj.price) {
        return formatPriceDataByPerspective(data, perspective);
      }

      // Handle weather data with perspective
      if (resultObj.temperature !== undefined || resultObj.location) {
        return formatWeatherDataByPerspective(data, perspective);
      }
    }
    
    // Fallback with perspective
    return formatFallbackByPerspective(data, perspective);
  };

  const formatPriceDataByPerspective = (data: Record<string, unknown>, perspective?: string): string => {
    const result = data.result as Record<string, unknown>;
    const symbol = result.symbol as string;
    const price = result.price as number;
    const confidence = (data.confidence as number * 100).toFixed(1);
    const sources = (data.sources as string[]).join(', ');

    switch (perspective) {
      case 'coingecko-oracle':
        return `💰 **${symbol} Financial Analysis**\n\n` +
               `💵 **Current Price:** $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}\n` +
               `📊 **Data Confidence:** ${confidence}% (${sources})\n` +
               (result.market_cap ? `📈 **Market Cap:** $${(result.market_cap as number).toLocaleString()}\n` : '') +
               (result.volume_24h ? `💹 **24h Volume:** $${(result.volume_24h as number).toLocaleString()}\n` : '') +
               (result.change_24h ? `${(result.change_24h as number) >= 0 ? '🟢' : '🔴'} **24h Change:** ${(result.change_24h as number).toFixed(2)}%\n` : '') +
               `\n🦎 **CoinGecko Data:** Real-time cryptocurrency market data from CoinGecko API.`;
      
      case 'web-search-oracle':
        return `📊 **${symbol} Market Intelligence**\n\n` +
               `🎯 **Price Signal:** $${price.toLocaleString()}\n` +
               `🧠 **Intelligence Grade:** ${confidence}% confidence\n` +
               `🔍 **Data Sources:** ${sources}\n` +
               (result.change_24h ? `📈 **Momentum:** ${(result.change_24h as number) >= 0 ? 'Bullish' : 'Bearish'} (${(result.change_24h as number).toFixed(2)}%)\n` : '') +
               `\n🔮 **Market Intelligence:** Real-time price discovery through consensus algorithms.`;
      
      default:
        return `💰 **${symbol} Price: $${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}**\n` +
               `📊 Confidence: ${confidence}%\n🔗 Sources: ${sources}` +
               (result.market_cap ? `\n📈 Market Cap: $${(result.market_cap as number).toLocaleString()}` : '') +
               (result.volume_24h ? `\n📊 24h Volume: $${(result.volume_24h as number).toLocaleString()}` : '') +
               (result.change_24h ? `\n${(result.change_24h as number) >= 0 ? '📈' : '📉'} 24h Change: ${(result.change_24h as number).toFixed(2)}%` : '');
    }
  };

  // System info formatting removed - no longer needed

  const formatWeatherDataByPerspective = (data: Record<string, unknown>, perspective?: string): string => {
    const result = data.result as Record<string, unknown>;
    
    switch (perspective) {
      case 'weather-oracle':
        return `🌍 **Environmental Analysis**\n\n` +
               `📍 **Location:** ${result.location || 'Unknown'}\n` +
               `🌡️ **Temperature:** ${result.temperature || 'N/A'}°C\n` +
               `💧 **Humidity:** ${result.humidity || 'N/A'}%\n` +
               `🌬️ **Wind Conditions:** ${result.wind_speed || 'N/A'} m/s\n` +
               `☁️ **Sky Conditions:** ${result.weather_description || 'N/A'}\n\n` +
               `🌿 **Environmental Perspective:** Real-time atmospheric monitoring for environmental assessment.`;
      
      default:
        return `🌤️ **Weather Data:** ${JSON.stringify(result)}`;
    }
  };

  const formatFallbackByPerspective = (data: Record<string, unknown>, perspective?: string): string => {
    const confidence = (data.confidence as number * 100).toFixed(1);
    const sources = (data.sources as string[]).join(', ');
    
    switch (perspective) {
      case 'web-search-oracle':
        return `🔍 **Web Search:** ${JSON.stringify(data.result)}\n📊 **Confidence:** ${confidence}% 🔗 **Sources:** ${sources}`;
      case 'weather-oracle':
        return `🌤️ **Weather Data:** ${JSON.stringify(data.result)}\n📊 **Accuracy:** ${confidence}% 🌿 **Sources:** ${sources}`;
      case 'coingecko-oracle':
        return `🦎 **CoinGecko:** ${JSON.stringify(data.result)}\n📊 **Confidence:** ${confidence}% 🔗 **Sources:** ${sources}`;
      case 'chat-oracle':
        return `💬 **Chat:** ${JSON.stringify(data.result)}\n📊 **Response:** ${confidence}% 🤖 **Sources:** ${sources}`;
      default:
        return `✅ **Oracle Response:** ${JSON.stringify(data.result)} 📊 Confidence: ${confidence}% 🔗 Sources: ${sources}`;
    }
  };

  const generateResponse = async (query: string, service: string): Promise<string> => {
    setConnectionStatus('connecting')
    
    // Get selected Oracle perspective
    const selectedOracle = perspectiveOracles.find(oracle => oracle.id === service);
    if (selectedOracle) {
      console.log(`🎭 Using ${selectedOracle.name} perspective for query: "${query}"`);
      console.log(`📋 Context: ${selectedOracle.context}`);
    }
    
    try {
      switch (service) {
        case 'coingecko-oracle':
        case 'coingecko':
          // Use direct API call to avoid state caching
          try {
            const directResponse = await oracleApi.query(query);
            
            if (directResponse.success) {
              setConnectionStatus('connected')
              return formatQueryResponse(directResponse.data, selectedOracle?.id);
            } else {
              setConnectionStatus('connected')
              return `❌ Query failed: ${directResponse.error || 'Unknown error'}`;
            }
          } catch (apiError: unknown) {
            setConnectionStatus('connected')
            return `❌ API Error: ${apiError instanceof Error ? apiError.message : 'Unknown API error'}`;
          }
          break;
          
        case 'weather-oracle':
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
          
        case 'web-search-oracle':
          // Route to web-scraping for market intelligence
          try {
            const intelligenceResponse = await oracleApi.query(query);
            
            if (intelligenceResponse.success) {
              setConnectionStatus('connected')
              return `🔍 **Web Search Analysis:**\n\n${formatQueryResponse(intelligenceResponse.data, 'web-search-oracle')}\n\n💡 *Analyzed using web scraping and search intelligence.*`;
            } else {
              setConnectionStatus('connected')
              return `❌ Market Intelligence analysis failed: ${intelligenceResponse.error || 'Unknown error'}`;
            }
          } catch (intelligenceError: unknown) {
            setConnectionStatus('connected')
            return `❌ Market Intelligence Error: ${intelligenceError instanceof Error ? intelligenceError.message : 'Unknown intelligence error'}`;
          }
          break;
          
        case 'chat-oracle':
          // Route to conversational AI
          try {
            const conversationResponse = await oracleApi.query(query);
            
            if (conversationResponse.success) {
              setConnectionStatus('connected')
              return `💬 **Chat Response:**\n\n${formatQueryResponse(conversationResponse.data, 'chat-oracle')}\n\n🤖 *Natural language conversation.*`;
            } else {
              setConnectionStatus('connected')
              return `❌ Conversational analysis failed: ${conversationResponse.error || 'Unknown error'}`;
            }
          } catch (conversationError: unknown) {
            setConnectionStatus('connected')
            return `❌ Conversational Error: ${conversationError instanceof Error ? conversationError.message : 'Unknown conversation error'}`;
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
              return formatQueryResponse(defaultResponse.data, selectedOracle?.id);
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
    
    const selectedOracle = perspectiveOracles.find(s => s.id === selectedService)
    const serviceName = selectedOracle?.name || 'Oracle Assistant'
    
    let welcomeContent = '';
    
    switch (selectedService) {
      case 'coingecko-oracle':
        welcomeContent = `🦎 **CoinGecko Oracle Activated!**\n\n💰 I'm your cryptocurrency market data specialist!\n\n**What I can do:**\n• Get real-time prices for BTC, ETH, BNB, ADA and 14+ cryptocurrencies\n• Provide market cap, trading volume, and 24h price changes\n• Multi-source price validation for accuracy\n\n**Try asking:**\n• "What's the Bitcoin price?"\n• "BNB price today"\n• "ETH market cap"\n• "Solana 24h change"\n\n🚀 Ready to fetch crypto data!`;
        break;
        
      case 'weather-oracle':
        welcomeContent = `🌤️ **Weather Oracle Activated!**\n\n🌍 I'm your global weather information specialist!\n\n**What I can do:**\n• Get current weather for any city worldwide\n• Provide temperature, humidity, wind speed\n• Weather conditions and forecasts\n• Climate data analysis\n\n**Try asking:**\n• "Weather in Istanbul"\n• "Temperature in London"\n• "How's the weather in Tokyo?"\n• "Climate in New York"\n\n☁️ Ready to check the skies!`;
        break;
        
      case 'web-search-oracle':
        welcomeContent = `🔍 **Web Search Oracle Activated!**\n\n🌐 I'm your web intelligence and search specialist!\n\n**What I can do:**\n• Scrape news and market data from websites\n• Search for current information online\n• Analyze web content and trends\n• Gather intelligence from multiple sources\n\n**Try asking:**\n• "Search for Bitcoin news"\n• "Latest crypto market trends"\n• "Web search: AI developments"\n• "Find information about..."\n\n🔎 Ready to search the web!`;
        break;
        
      case 'chat-oracle':
        welcomeContent = `💬 **Chat Oracle Activated!**\n\n🤖 I'm your conversational AI companion!\n\n**What I can do:**\n• Have friendly natural conversations\n• Answer questions about the Oracle system\n• Provide help and explanations\n• Chat about various topics\n\n**Try saying:**\n• "Hello! How are you?"\n• "What can you help me with?"\n• "Tell me about this system"\n• "I need some assistance"\n\n💫 Ready for a chat!`;
        break;
        
      default:
        welcomeContent = `🎭 ${serviceName} activated!\n\n🔮 Oracle system ready to assist you.\n\nWhat would you like me to help you with?`;
    }
    
    const welcomeMessage: Message = {
      id: (Date.now() + 2).toString(),
      type: 'assistant',
      content: welcomeContent,
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
              <div className="text-sm whitespace-pre-wrap">{message.content}</div>
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