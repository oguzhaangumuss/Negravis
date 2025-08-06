import { motion } from 'framer-motion'

export default function Dashboard() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold gradient-negravis">
            Negravis Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Oracle network overview and system monitoring
          </p>
        </div>
      </div>

      {/* Placeholder content */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* System Health Card */}
        <div className="glass rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">System Health</h3>
          <div className="text-2xl font-bold text-green-500">99.9%</div>
          <p className="text-sm text-muted-foreground">All systems operational</p>
        </div>

        {/* Active Oracles */}
        <div className="glass rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Active Oracles</h3>
          <div className="text-2xl font-bold text-blue-500">5/6</div>
          <p className="text-sm text-muted-foreground">Providers online</p>
        </div>

        {/* API Requests */}
        <div className="glass rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">API Requests</h3>
          <div className="text-2xl font-bold text-purple-500">1.2K</div>
          <p className="text-sm text-muted-foreground">Last 24 hours</p>
        </div>

        {/* Response Time */}
        <div className="glass rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-2">Avg Response</h3>
          <div className="text-2xl font-bold text-orange-500">85ms</div>
          <p className="text-sm text-muted-foreground">Network latency</p>
        </div>
      </div>

      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Dashboard Under Construction</h2>
        <p className="text-muted-foreground">
          Advanced dashboard components coming soon...
        </p>
      </div>
    </motion.div>
  )
}