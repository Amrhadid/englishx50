import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import Landing from './pages/Landing'
import Join from './pages/Join'
import Challenge from './pages/Challenge'
import Terms from './pages/Terms'
import Admin from './pages/Admin'
import Speaking from './pages/Speaking'
import Rehearsal from './pages/Rehearsal'
import ReviewsPage from './pages/ReviewsPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/join" element={<Join />} />
        <Route path="/challenge" element={<Challenge />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/reviews" element={<ReviewsPage />} />
        {/* Preview of the same three sections, with a forced-view toggle. */}
        <Route path="/rehearsal" element={<Rehearsal />} />
        {/* The old program page is now the first half of /join. */}
        <Route path="/program" element={<Navigate to="/join" replace />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/speaking" element={<Speaking />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
