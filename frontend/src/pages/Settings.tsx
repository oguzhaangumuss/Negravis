import { motion } from 'framer-motion'

export default function Settings() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-8"
    >
      <div>
        <h1 className="text-3xl font-bold gradient-negravis">
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          System configuration and preferences
        </p>
      </div>

      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Settings Panel Coming Soon</h2>
        <p className="text-muted-foreground">
          Configuration options in development...
        </p>
      </div>
    </motion.div>
  )
}