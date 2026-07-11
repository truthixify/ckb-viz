import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './styles/tokens.css'

import { App } from './app/App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A committed transaction is immutable, so caching is trivially correct.
      staleTime: Infinity,
      gcTime: 1000 * 60 * 60,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element #root not found')

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
