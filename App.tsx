
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import DossierDetail from './components/DossierDetail';
import Header from './components/Header';

const App: React.FC = () => {
  const { currentUser } = useAuth();

  const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (!currentUser) {
      return <Navigate to="/auth" />;
    }
    return (
        <>
            <Header />
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                {children}
            </main>
        </>
    );
  };

  const AuthRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    if (currentUser) {
      return <Navigate to="/" />;
    }
    return <>{children}</>;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/auth" element={
          <AuthRoute>
            <AuthPage />
          </AuthRoute>
        } />
        <Route path="/" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/dossier/:id" element={
          <ProtectedRoute>
            <DossierDetail />
          </ProtectedRoute>
        } />
        <Route path="*" element={<Navigate to={currentUser ? "/" : "/auth"} />} />
      </Routes>
    </HashRouter>
  );
};

export default App;
