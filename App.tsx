

import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import DossierDetail from './components/DossierDetail';
import Header from './components/Header';

const CookieConsentBanner: React.FC = () => {
    const [showBanner, setShowBanner] = useState(false);

    useEffect(() => {
        try {
            const consent = localStorage.getItem('cookie_consent');
            if (!consent) {
                setShowBanner(true);
            }
        } catch (error) {
            console.error("Could not access localStorage: ", error);
        }
    }, []);

    const handleAccept = () => {
        try {
            localStorage.setItem('cookie_consent', 'true');
            setShowBanner(false);
        } catch (error) {
             console.error("Could not access localStorage: ", error);
        }
    };

    if (!showBanner) {
        return null;
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-800 text-white p-4 z-50 shadow-lg flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in-up">
            <style>{`
                @keyframes fade-in-up {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fade-in-up { animation: fade-in-up 0.5s ease-out forwards; }
            `}</style>
            <p className="text-sm text-center sm:text-left">
                Este sitio web utiliza cookies esenciales para garantizar su correcto funcionamiento. Al continuar, aceptas su uso.
            </p>
            <button
                onClick={handleAccept}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors duration-200 whitespace-nowrap"
            >
                Aceptar y Cerrar
            </button>
        </div>
    );
};


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
      <CookieConsentBanner />
    </HashRouter>
  );
};

export default App;