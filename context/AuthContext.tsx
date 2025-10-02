import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { AppUser, UserProfile } from '../types';
import Spinner from '../components/Spinner';

interface AuthContextType {
  currentUser: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
});

export function useAuth(): AuthContextType {
  return useContext(AuthContext);
}

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // --- MOCK AUTHENTICATION FOR TESTING ---
    // This section bypasses Firebase Auth for development/testing purposes.
    // It simulates a logged-in ENTITY user.
    const mockUser: AppUser = {
      uid: 'mock-user-uid-123',
      email: 'entidad@ejemplo.com',
      profile: {
        uid: 'mock-user-uid-123',
        email: 'entidad@ejemplo.com',
        entityName: 'Entidad de Prueba',
        role: 'ENTITY',
      },
    };
    setCurrentUser(mockUser);
    setLoading(false);
    // --- END OF MOCK AUTHENTICATION ---

    /*
    // Original Firebase Auth logic is commented out below
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        // Fetch user profile from Firestore
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const userProfile = userDoc.data() as UserProfile;
          const appUser: AppUser = { ...user, profile: userProfile };
          setCurrentUser(appUser);
        } else {
          // Handle case where auth user exists but no profile doc
          setCurrentUser(user);
        }
      } else {
        setCurrentUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
    */
  }, []);

  const value = {
    currentUser,
    loading,
  };

  if (loading) {
      return (
          <div className="flex items-center justify-center h-screen bg-slate-100">
              <Spinner />
          </div>
      )
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};