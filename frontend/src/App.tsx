import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import ChatPage from './pages/chat/ChatPage'
import DocumentsPage from './pages/documents/DocumentsPage'
import ExplorerPage from './pages/explorer/ExplorerPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/documents" replace />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="explorer" element={<ExplorerPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="ask" element={<Navigate to="/chat" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
