import { Routes, Route } from 'react-router-dom'
import { ThemeProvider } from 'next-themes'
import Dashboard from '@/pages/Dashboard'
import Oracle from '@/pages/Oracle'
import Analytics from '@/pages/Analytics'
import Settings from '@/pages/Settings'
import Layout from '@/components/layouts/Layout'

function App() {
  return (
    <ThemeProvider 
      attribute="class" 
      defaultTheme="dark" 
      enableSystem={false}
      storageKey="negravis-theme"
    >
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/oracle" element={<Oracle />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </ThemeProvider>
  )
}

export default App