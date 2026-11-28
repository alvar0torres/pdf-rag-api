import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import ChatPage from './pages/chat/ChatPage'
import { useChatState } from './pages/chat/useChatState'
import DocumentsPage from './pages/documents/DocumentsPage'
import ExplorerPage from './pages/explorer/ExplorerPage'
import EvaluationPage from './pages/evaluation/EvaluationPage'

const EmbeddingMapPage = lazy(() => import('./pages/map/EmbeddingMapPage'))

function App() {
  const chat = useChatState()

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/documents" replace />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="explorer" element={<ExplorerPage />} />
          <Route path="evaluation" element={<EvaluationPage />} />
          <Route path="map" element={<Suspense fallback={<p role="status">Loading map…</p>}><EmbeddingMapPage /></Suspense>} />
          <Route path="chat" element={<ChatPage chat={chat} />} />
          <Route path="ask" element={<Navigate to="/chat" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
