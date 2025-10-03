
import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import type { Dossier, Support } from '../types';
import { DossierStatus } from '../types';
import Spinner from './Spinner';
import { Plus, X, Calendar, FileText, ChevronsRight, FileUp, Sparkles } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { SUPPORT_TYPES } from '../constants';

const statusStyles: { [key in DossierStatus]: string } = {
    [DossierStatus.DRAFT]: 'bg-yellow-100 text-yellow-800',
    [DossierStatus.SUBMITTED]: 'bg-blue-100 text-blue-800',
    [DossierStatus.APPROVED]: 'bg-green-100 text-green-800',
    [DossierStatus.REJECTED]: 'bg-red-100 text-red-800',
};

const CreateDossierModal: React.FC<{ isOpen: boolean; onClose: () => void; entityName: string; userId: string;}> = ({ isOpen, onClose, entityName, userId }) => {
    const [eventName, setEventName] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!eventName || !eventDate) {
            setError('Todos los campos son obligatorios.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await addDoc(collection(db, 'dossiers'), {
                userId,
                entityName,
                eventName,
                eventDate,
                status: DossierStatus.DRAFT,
                supports: [],
                createdAt: serverTimestamp()
            });
            onClose();
            setEventName('');
            setEventDate('');
        } catch (err) {
            console.error("Error creating dossier: ", err);
            setError('No se pudo crear el dossier. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X size={24} />
                </button>
                <h2 className="text-2xl font-bold text-slate-800 mb-4">Crear Nuevo Dossier</h2>
                <form onSubmit={handleSubmit}>
                    {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md mb-4">{error}</p>}
                    <div className="mb-4">
                        <label className="block text-slate-600 text-sm font-medium mb-2">Nombre de la Entidad</label>
                        <input type="text" value={entityName} disabled className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-md" />
                    </div>
                    <div className="mb-4">
                        <label htmlFor="eventName" className="block text-slate-600 text-sm font-medium mb-2">Nombre del Evento</label>
                        <input id="eventName" type="text" value={eventName} onChange={e => setEventName(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500" />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="eventDate" className="block text-slate-600 text-sm font-medium mb-2">Fecha del Evento</label>
                        <input id="eventDate" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500" />
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button type="button" onClick={onClose} className="py-2 px-4 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition">Cancelar</button>
                        <button type="submit" disabled={loading} className="py-2 px-4 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition flex items-center">
                            {loading ? <Spinner className="h-5 w-5 mr-2" /> : null}
                            Crear Dossier
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const ContractUploadModal: React.FC<{ isOpen: boolean; onClose: () => void; entityName: string; userId: string; }> = ({ isOpen, onClose, entityName, userId }) => {
    const [contractFile, setContractFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setContractFile(e.target.files[0]);
        }
    };

    const resetForm = () => {
        setContractFile(null);
        setError('');
        setLoading(false);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!contractFile) {
            setError('Debes seleccionar un archivo de contrato.');
            return;
        }
        setLoading(true);
        setError('');

        try {
            if (!process.env.API_KEY) {
                throw new Error("La clave de API de Gemini no está configurada.");
            }
            
            const fileAsBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(contractFile);
            });

            const imagePart = {
                inlineData: {
                    mimeType: contractFile.type,
                    data: fileAsBase64,
                },
            };

            const textPart = {
                text: `Eres un asistente especializado en analizar contratos de patrocinio. A partir de la imagen del contrato adjunta, extrae la siguiente información:
1. El nombre del evento.
2. La fecha del evento, en formato YYYY-MM-DD.
3. Una lista de todos los soportes publicitarios que la entidad patrocinada debe realizar. La lista de soportes válidos es: ${SUPPORT_TYPES.join(', ')}.

Devuelve tu respuesta EXCLUSIVAMENTE en formato JSON. La estructura debe ser:
{
  "eventName": "Nombre del Evento Extraído",
  "eventDate": "YYYY-MM-DD",
  "soportes": ["Soporte 1", "Soporte 2", ...]
}
Si no encuentras algún dato, déjalo como un string vacío. Si no identificas soportes, devuelve un array vacío.`
            };
            
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart, textPart] },
                config: {
                    responseMimeType: 'application/json',
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            eventName: { type: Type.STRING },
                            eventDate: { type: Type.STRING },
                            soportes: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.STRING
                                }
                            }
                        },
                        required: ['eventName', 'eventDate', 'soportes']
                    }
                }
            });
            
            const responseText = response.text;
            const result = JSON.parse(responseText);
            const { eventName: extractedEventName, eventDate: extractedEventDate, soportes: identifiedSupports } = result;

            if (!extractedEventName || !extractedEventDate) {
                throw new Error("No se pudo extraer el nombre o la fecha del evento del contrato. Asegúrate de que la imagen sea clara y legible.");
            }

            if (!identifiedSupports || identifiedSupports.length === 0) {
                throw new Error("No se encontraron soportes publicitarios válidos en el contrato.");
            }

            const newSupports: Support[] = identifiedSupports
                .filter(type => SUPPORT_TYPES.includes(type))
                .map(type => ({
                    id: `${Date.now()}-${type.replace(/\s+/g, '-')}`,
                    type,
                    evidences: []
                }));

            await addDoc(collection(db, 'dossiers'), {
                userId,
                entityName,
                eventName: extractedEventName,
                eventDate: extractedEventDate,
                status: DossierStatus.DRAFT,
                supports: newSupports,
                createdAt: serverTimestamp()
            });

            handleClose();

        } catch (err) {
            console.error("Error creating dossier with AI: ", err);
            setError(`Error: ${(err as Error).message}. Asegúrate de que la imagen sea clara e inténtalo de nuevo.`);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 relative">
                <button onClick={handleClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X size={24} />
                </button>
                <div className="flex items-center space-x-3 mb-4">
                    <Sparkles className="h-8 w-8 text-sky-600" />
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800">Crear Dossier con IA</h2>
                        <p className="text-sm text-slate-500">Sube una imagen del contrato y la IA extraerá los detalles.</p>
                    </div>
                </div>
                <form onSubmit={handleSubmit}>
                    {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md mb-4">{error}</p>}
                    <div className="mb-4">
                        <label className="block text-slate-600 text-sm font-medium mb-2">Nombre de la Entidad</label>
                        <input type="text" value={entityName} disabled className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-md" />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="contractFile" className="block text-slate-600 text-sm font-medium mb-2">Archivo del Contrato (Imagen)</label>
                        <input id="contractFile" type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} required className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100" />
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button type="button" onClick={handleClose} className="py-2 px-4 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition">Cancelar</button>
                        <button type="submit" disabled={loading} className="py-2 px-4 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition flex items-center min-w-[150px] justify-center">
                            {loading ? <><Spinner className="h-5 w-5 mr-2" /> <span>Analizando...</span></> : <><Sparkles size={16} className="mr-2"/><span>Analizar y Crear</span></>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};


const Dashboard: React.FC = () => {
  const [dossiers, setDossiers] = useState<Dossier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    const q = query(
        collection(db, 'dossiers'), 
        where('userId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const dossiersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dossier));
      setDossiers(dossiersData);
      setLoading(false);
    }, (error) => {
        console.error("Error fetching dossiers: ", error);
        setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  if (loading) {
    return <div className="flex justify-center items-center mt-16"><Spinner /></div>;
  }

  return (
    <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h1 className="text-3xl font-bold text-slate-800">Mis Dossiers</h1>
            <div className="flex flex-wrap gap-2">
                 <button onClick={() => setIsContractModalOpen(true)} className="flex items-center space-x-2 bg-white text-sky-600 border border-sky-600 py-2 px-4 rounded-lg shadow-sm hover:bg-sky-50 transition">
                    <Sparkles size={20} />
                    <span>Crear con IA</span>
                </button>
                <button onClick={() => setIsModalOpen(true)} className="flex items-center space-x-2 bg-sky-600 text-white py-2 px-4 rounded-lg shadow-md hover:bg-sky-700 transition">
                    <Plus size={20} />
                    <span>Crear Nuevo Dossier</span>
                </button>
            </div>
        </div>
        
        {dossiers.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-lg shadow">
                <FileText size={48} className="mx-auto text-slate-400" />
                <h3 className="mt-4 text-xl font-semibold text-slate-700">No hay dossiers todavía</h3>
                <p className="mt-1 text-slate-500">Haz clic en "Crear Nuevo Dossier" para empezar.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {dossiers.map(dossier => (
                    <Link to={`/dossier/${dossier.id}`} key={dossier.id} className="block bg-white p-6 rounded-lg shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                        <div className="flex justify-between items-start">
                           <h2 className="text-xl font-bold text-slate-800 mb-2">{dossier.eventName}</h2>
                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[dossier.status]}`}>
                                {dossier.status}
                            </span>
                        </div>
                        <div className="flex items-center space-x-2 text-slate-500 text-sm mt-4">
                            <Calendar size={16} />
                            <span>{new Date(dossier.eventDate).toLocaleDateString()}</span>
                        </div>
                         <div className="border-t my-4"></div>
                         <div className="flex justify-end items-center text-sky-600 font-medium text-sm">
                            <span>Ver detalles</span>
                            <ChevronsRight size={18} className="ml-1"/>
                         </div>
                    </Link>
                ))}
            </div>
        )}

        <CreateDossierModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)}
            entityName={currentUser?.profile?.entityName || ''}
            userId={currentUser?.uid || ''}
        />

        <ContractUploadModal
            isOpen={isContractModalOpen}
            onClose={() => setIsContractModalOpen(false)}
            entityName={currentUser?.profile?.entityName || ''}
            userId={currentUser?.uid || ''}
        />
    </div>
  );
};

export default Dashboard;