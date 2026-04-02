/**
 * App.tsx
 * Root component: sets up React Router and the main layout.
 * Routes: /upload (Upload Data), /dashboard (Dashboard), /reports (Reports).
 * Redirects / to /dashboard for a single primary entry point.
 */

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { UploadPage } from "./pages/UploadPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ReportsPage } from "./pages/ReportsPage";
import { FilesPage } from "./pages/FilesPage";
import { ScoreboardPage } from "./pages/ScoreboardPage";
import { LoginPage } from "./pages/LoginPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import { AboutPage } from "./pages/AboutPage";
import { OutlookPage } from "./pages/OutlookPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="camel" element={<ScoreboardPage />} />
          <Route path="scoreboard" element={<Navigate to="/camel" replace />} />
          <Route path="login" element={<LoginPage />} />

          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="upload" element={<UploadPage />} />
            <Route path="files" element={<FilesPage />} />
            <Route path="outlook" element={<OutlookPage />} />
          </Route>

          <Route path="reports" element={<ReportsPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
