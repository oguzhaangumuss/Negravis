import { motion } from 'framer-motion'

export default function Analytics() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-3xl font-bold gradient-negravis">
          Network Analytics
        </h1>
        <p className="text-muted-foreground mt-2">
          Hedera network metrics and performance insights
        </p>
      </div>

      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Analytics Dashboard Coming Soon</h2>
        <p className="text-muted-foreground">
          Comprehensive network analytics in development...
        </p>
      </div>
    </motion.div>
  )
}