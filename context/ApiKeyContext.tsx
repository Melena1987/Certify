import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ApiKeyContextType {
  apiKey: string | null;
  isApiKeyLoading: boolean;
  apiKeyError: string | null;
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

export const ApiKeyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isApiKeyLoading, setIsLoading] = useState(true);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);

  useEffect(() => {
    const fetchApiKey = async () => {
      try {
        const response = await fetch('/.netlify/functions/get-api-key');
        if (!response.ok) {
          throw new Error('No se pudo obtener la clave de API del servidor.');
        }
        const data = await response.json();
        if (!data.apiKey) {
            throw new Error('La clave de API recibida del servidor está vacía. Asegúrate de que esté configurada en Netlify.');
        }
        setApiKey(data.apiKey);
        setApiKeyError(null);
      } catch (error) {
        console.error("Error fetching API key:", error);
        const errorMessage = error instanceof Error ? error.message : 'Un error desconocido ocurrió.';
        setApiKeyError(`Error de configuración: ${errorMessage} La funcionalidad de IA puede no funcionar.`);
        setApiKey(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApiKey();
  }, []);

  return (
    <ApiKeyContext.Provider value={{ apiKey, isApiKeyLoading, apiKeyError }}>
      {children}
    </ApiKeyContext.Provider>
  );
};

export const useApiKey = () => {
  const context = useContext(ApiKeyContext);
  if (context === undefined) {
    throw new Error('useApiKey must be used within an ApiKeyProvider');
  }
  return context;
};
