'use client'

import dynamic from 'next/dynamic'

// Dynamically import the landing page to avoid SSR issues with Three.js
const LandingPage = dynamic(() => import('../../landing-page'), {
  ssr: false,
})

export default function Home() {
  return <LandingPage />
}
