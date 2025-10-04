import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthPage from './AuthPage';
import Dashboard from './Dashboard';
import DossierDetail from './DossierDetail';
import Header from './Header';
import AdminDashboard from './AdminDashboard';
import EntityDossiers from './EntityDossiers';

const AppRouter: React.FC = () => {
    const { currentUser } = useAuth();
    const userRole = currentUser?.profile?.role;

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
            const homePath = userRole === 'DIPUTACION' ? '/admin' : '/';
            return <Navigate to={homePath} />;
        }
        return <>{children}</>;
    };

    const homePath = userRole === 'DIPUTACION' ? '/admin' : '/';

    return (
        <Routes>
            <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
            
            {/* Entity Routes */}
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/dossier/:id" element={<ProtectedRoute><DossierDetail /></ProtectedRoute>} />

            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/entity/:entityId" element={<ProtectedRoute><EntityDossiers /></ProtectedRoute>} />
            <Route path="/admin/dossier/:id" element={<ProtectedRoute><DossierDetail /></ProtectedRoute>} />
            
            <Route path="*" element={<Navigate to={currentUser ? homePath : "/auth"} />} />
        </Routes>
    );
};

export default AppRouter;