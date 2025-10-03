import React from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { LogOut, ShieldCheck } from 'lucide-react';

const Header: React.FC = () => {
  const { currentUser } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <img
              src="https://firebasestorage.googleapis.com/v0/b/certify-diputacion.firebasestorage.app/o/recursos%2Fmarca_mlg_compite_diputacion_monocromatico_azul.png?alt=media&token=f2295896-b2f4-44c2-a3f8-8f895e994eb8"
              alt="Logo de la Diputación de Málaga"
              className="h-12 mr-4"
            />
            <div className="flex items-center space-x-3">
              <ShieldCheck className="h-8 w-8 text-sky-600" />
              <span className="text-2xl font-bold text-slate-800">Certify</span>
            </div>
          </div>
          {currentUser && (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600 hidden sm:block">
                {currentUser.profile?.entityName || currentUser.email}
              </span>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 text-sm text-slate-600 hover:text-sky-600 transition-colors duration-200"
                aria-label="Cerrar sesión"
              >
                <LogOut className="h-5 w-5" />
                <span className="hidden md:block">Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;