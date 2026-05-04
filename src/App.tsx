import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './components/LandingPage.tsx';
import IDE from './components/IDE.tsx';
import ScanOverlay from './components/ScanOverlay.tsx';
import ReportPreview from './components/ReportPreview.tsx';
import './index.css';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <main className="app-content">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/ide" element={<IDE />} />
            <Route path="/scanning" element={<ScanOverlay />} />
            <Route path="/report" element={<ReportPreview />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
};

export default App;
