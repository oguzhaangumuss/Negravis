'use client'

import { Merriweather } from 'next/font/google'
import { Database, Brain, Network, BarChart3, Zap } from 'lucide-react'
import OracleAssistant from '../../components/OracleAssistant'

const merriweather = Merriweather({ 
  subsets: ['latin'],
  weight: ['300', '400', '700', '900'],
  variable: '--font-merriweather'
})

export default function DAppPage() {
  return (
    <div className={`min-h-screen bg-black text-white ${merriweather.className}`}>
      {/* Header */}
      <header className="border-b border-gray-800">
        <nav className="flex justify-between items-center max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded"></div>
            <span className="text-xl font-bold">Negravis</span>
          </div>
          <div className="flex items-center gap-6">
            <button className="text-gray-300 hover:text-white">Dashboard</button>
            <button className="text-gray-300 hover:text-white">Oracle API</button>
            <button className="text-gray-300 hover:text-white">Analytics</button>
            <button className="bg-white text-black px-4 py-2 rounded-md font-semibold">Connect Wallet</button>
          </div>
        </nav>
      </header>

      {/* Main Dashboard */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Oracle & AI Dashboard</h1>
          <p className="text-gray-400">Manage your multi-source data aggregation and AI model integrations</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Database className="w-5 h-5 text-blue-400" />
              <h3 className="font-semibold">Oracle Queries</h3>
            </div>
            <p className="text-2xl font-bold">1,247</p>
            <p className="text-sm text-gray-400">+12% from last week</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Brain className="w-5 h-5 text-purple-400" />
              <h3 className="font-semibold">AI Executions</h3>
            </div>
            <p className="text-2xl font-bold">843</p>
            <p className="text-sm text-gray-400">+8% from last week</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Network className="w-5 h-5 text-green-400" />
              <h3 className="font-semibold">Hedera HCS</h3>
            </div>
            <p className="text-2xl font-bold">5,692</p>
            <p className="text-sm text-gray-400">Messages logged</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              <h3 className="font-semibold">Avg Response</h3>
            </div>
            <p className="text-2xl font-bold">324ms</p>
            <p className="text-sm text-gray-400">-5% improvement</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Oracle Assistant Chatbot */}
          <div className="lg:col-span-2">
            <div className="bg-gray-900 border border-gray-800 rounded-lg h-[700px] overflow-hidden">
              <OracleAssistant />
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Recent Activity
            </h2>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-md">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <div>
                  <p className="font-medium">Oracle Query Success</p>
                  <p className="text-sm text-gray-400">ETH/USD: $2,345.67</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-md">
                <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                <div>
                  <p className="font-medium">AI Model Executed</p>
                  <p className="text-sm text-gray-400">llama-3.3-70b completion</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-md">
                <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                <div>
                  <p className="font-medium">HCS Message Logged</p>
                  <p className="text-sm text-gray-400">Topic: 0.0.12345</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}