import { Database, Brain, Shield, Network, Zap, BarChart3 } from 'lucide-react'

export default function Features() {
    return (
        <section className="py-12 md:py-20 bg-black text-white">
            <div className="mx-auto max-w-5xl space-y-8 px-6 md:space-y-16">
                <div className="relative z-10 mx-auto max-w-xl space-y-6 text-center md:space-y-12">
                    <h2 className="text-balance text-4xl font-medium lg:text-5xl">Enterprise-Grade Oracle & AI Infrastructure</h2>
                    <p className="text-gray-300">Negravis delivers production-ready multi-source data aggregation with AI model integration, powered by Hedera Hashgraph blockchain technology.</p>
                </div>

                <div className="relative mx-auto grid max-w-4xl divide-x divide-y divide-gray-800 border border-gray-800 *:p-12 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Database className="size-5 text-blue-400" />
                            <h3 className="text-lg font-medium">Multi-Source Oracle</h3>
                        </div>
                        <p className="text-sm text-gray-300">Chainlink, CoinGecko, Weather APIs with advanced consensus algorithms (Median, Weighted Average, Majority Vote)</p>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Brain className="size-5 text-purple-400" />
                            <h3 className="text-lg font-medium">AI Integration</h3>
                        </div>
                        <p className="text-sm text-gray-300">llama-3.3-70b & deepseek-r1-70b models via 0G Compute Network with TEE verification</p>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Network className="size-5 text-green-400" />
                            <h3 className="text-lg font-medium">Hedera Blockchain</h3>
                        </div>
                        <p className="text-sm text-gray-300">HCS real-time logging, HashScan explorer integration, and immutable data tracking</p>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Zap className="size-5 text-yellow-400" />
                            <h3 className="text-lg font-medium">High Performance</h3>
                        </div>
                        <p className="text-sm text-gray-300">300ms average response time, 50+ concurrent queries, 85%+ cache hit rate</p>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <Shield className="size-5 text-red-400" />
                            <h3 className="text-lg font-medium">Production Ready</h3>
                        </div>
                        <p className="text-sm text-gray-300">90%+ test coverage, comprehensive error handling, enterprise-grade architecture</p>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="size-5 text-cyan-400" />
                            <h3 className="text-lg font-medium">Analytics & Monitoring</h3>
                        </div>
                        <p className="text-sm text-gray-300">Real-time metrics, cost tracking, performance monitoring with Swagger/OpenAPI docs</p>
                    </div>
                </div>
            </div>
        </section>
    )
}
