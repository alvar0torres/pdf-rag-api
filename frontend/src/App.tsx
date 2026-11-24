import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import AskPage from './pages/ask/AskPage'
import DocumentsPage from './pages/documents/DocumentsPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/documents" replace />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="ask" element={<AskPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
