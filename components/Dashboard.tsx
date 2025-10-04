import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import type { Dossier, Support } from '../types';
import { DossierStatus, SupportStatus } from '../types';
import Spinner from './Spinner';
import { Plus, X, Calendar, FileText, ChevronsRight, Sparkles, Trash2, AlertTriangle } from 'lucide-react';
import { GoogleGenAI, Type } from '@google/genai';
import { SUPPORT_TYPES } from '../constants';
import { useApiKey } from '../context/ApiKeyContext';

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
    const { apiKey, apiKeyError } = useApiKey();

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
        if (!apiKey) {
            setError(apiKeyError || 'La clave de API para la IA no está disponible. No se puede procesar el contrato.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const fileAsBase64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(contractFile);
            });

            const filePart = {
                inlineData: {
                    mimeType: contractFile.type,
                    data: fileAsBase64,
                },
            };

            const textPart = {
                text: `Eres un asistente especializado en analizar contratos de patrocinio. A partir del documento PDF del contrato adjunto, extrae la siguiente información:
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
            
            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [filePart, textPart] },
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
                throw new Error("No se pudo extraer el nombre o la fecha del evento. Asegúrate de que el PDF sea claro y legible.");
            }

            if (!identifiedSupports || identifiedSupports.length === 0) {
                throw new Error("No se encontraron soportes publicitarios válidos en el contrato.");
            }

            const newSupports: Support[] = identifiedSupports
                .filter((type: string) => SUPPORT_TYPES.includes(type))
                .map((type: string) => ({
                    id: `${Date.now()}-${type.replace(/\s+/g, '-')}`,
                    type,
                    evidences: [],
                    status: SupportStatus.PENDING,
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

        } catch (err: any) {
            console.error("Error creating dossier with AI: ", err);
            let userMessage = (err as Error).message;
            if (userMessage.toLowerCase().includes('permission')) {
                 userMessage = 'Permisos insuficientes. Esto puede ocurrir si tu cuenta es nueva. Por favor, intenta recargar la página o volver a iniciar sesión antes de reintentarlo.';
            } else if (userMessage.toLowerCase().includes('json')) {
                userMessage = 'La IA no pudo procesar el documento correctamente. Asegúrate de que el PDF sea claro y contenga la información requerida.';
            }
            setError(`Error al procesar el documento: ${userMessage}`);
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
                        <p className="text-sm text-slate-500">Sube el contrato en formato PDF y la IA extraerá los detalles.</p>
                    </div>
                </div>
                <form onSubmit={handleSubmit}>
                    {error && <p className="text-sm text-red-600 bg-red-100 p-2 rounded-md mb-4">{error}</p>}
                    <div className="mb-4">
                        <label className="block text-slate-600 text-sm font-medium mb-2">Nombre de la Entidad</label>
                        <input type="text" value={entityName} disabled className="w-full px-4 py-2 bg-slate-100 border border-slate-300 rounded-md" />
                    </div>
                    <div className="mb-6">
                        <label htmlFor="contractFile" className="block text-slate-600 text-sm font-medium mb-2">Archivo del Contrato (PDF)</label>
                        <input id="contractFile" type="file" accept="application/pdf" onChange={handleFileChange} required className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100" />
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button type="button" onClick={handleClose} className="py-2 px-4 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition">Cancelar</button>
                        <button type="submit" disabled={loading || !apiKey} className="py-2 px-4 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition flex items-center min-w-[150px] justify-center disabled:bg-slate-400 disabled:cursor-not-allowed">
                            {loading ? <><Spinner className="h-5 w-5 mr-2" /> <span>Analizando...</span></> : <><Sparkles size={16} className="mr-2"/><span>Analizar y Crear</span></>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const DeleteConfirmationModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; dossierName: string; isLoading: boolean; error: string; }> = ({ isOpen, onClose, onConfirm, dossierName, isLoading, error }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
                <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                        <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                            Borrar Dossier
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-gray-500">
                                ¿Estás seguro de que quieres borrar el dossier "<strong>{dossierName}</strong>"? Todas las evidencias asociadas serán eliminadas permanentemente. Esta acción no se puede deshacer.
                            </p>
                        </div>
                    </div>
                </div>
                 {error && (
                    <div className="mt-4 bg-red-100 p-3 rounded-lg text-sm text-red-800" role="alert">
                        <p>{error}</p>
                    </div>
                )}
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                    <button
                        type="button"
                        className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm disabled:bg-red-400"
                        onClick={onConfirm}
                        disabled={isLoading}
                    >
                        {isLoading ? <Spinner className="h-5 w-5" /> : 'Borrar'}
                    </button>
                    <button
                        type="button"
                        className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 sm:mt-0 sm:w-auto sm:text-sm"
                        onClick={onClose}
                        disabled={isLoading}
                    >
                        Cancelar
                    </button>
                </div>
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
  const [dossierToDelete, setDossierToDelete] = useState<Dossier | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const { apiKeyError } = useApiKey();

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
  
  const handleCloseDeleteModal = () => {
    setDossierToDelete(null);
    setDeleteError('');
  };

  const handleDeleteDossier = async () => {
    if (!dossierToDelete) return;

    setIsDeleteLoading(true);
    setDeleteError('');
    try {
        // Delete associated files from storage
        const evidenceFiles: string[] = [];
        dossierToDelete.supports.forEach(support => {
            support.evidences.forEach(evidence => {
                if (evidence.type === 'image') {
                    evidenceFiles.push(evidence.value);
                }
            });
        });

        for (const fileUrl of evidenceFiles) {
            try {
                const fileRef = ref(storage, fileUrl);
                await deleteObject(fileRef);
            } catch (error: any) {
                // Ignore not-found errors, as the file might have already been deleted or the URL is invalid.
                if (error.code !== 'storage/object-not-found') {
                    console.error(`Failed to delete file ${fileUrl}:`, error);
                }
            }
        }
        
        // Delete the dossier document from Firestore
        const dossierRef = doc(db, 'dossiers', dossierToDelete.id);
        await deleteDoc(dossierRef);

        handleCloseDeleteModal();

    } catch (error) {
        console.error("Error deleting dossier: ", error);
        setDeleteError('No se pudo borrar el dossier. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
        setIsDeleteLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center mt-16"><Spinner /></div>;
  }

  return (
    <div>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
                <h1 className="text-3xl font-bold text-slate-800">Mis Dossiers</h1>
                {apiKeyError && <p className="mt-1 text-xs text-red-600 bg-red-50 p-2 rounded-md">{apiKeyError}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
                 <button onClick={() => setIsContractModalOpen(true)} className="flex items-center space-x-2 bg-white text-sky-600 border border-sky-600 py-2 px-4 rounded-lg shadow-sm hover:bg-sky-50 transition">
                    <Sparkles size={20} />
                    <span>Subir contrato</span>
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
                    <div key={dossier.id} className="bg-white p-6 rounded-lg shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                        <div>
                            <div className="flex justify-between items-start">
                               <h2 className="text-xl font-bold text-slate-800 mb-2 pr-4 break-words">{dossier.eventName}</h2>
                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${statusStyles[dossier.status]} whitespace-nowrap h-fit`}>
                                    {dossier.status}
                                </span>
                            </div>
                            <div className="flex items-center space-x-2 text-slate-500 text-sm mt-4">
                                <Calendar size={16} />
                                <span>{new Date(dossier.eventDate).toLocaleDateString('es-ES')}</span>
                            </div>
                        </div>
                         <div className="border-t mt-4 pt-4 flex justify-between items-center">
                             <Link to={`/dossier/${dossier.id}`} className="flex items-center text-sky-600 font-medium text-sm hover:underline">
                                <span>Ver detalles</span>
                                <ChevronsRight size={18} className="ml-1"/>
                             </Link>
                             {dossier.status === DossierStatus.DRAFT && (
                                <button
                                    onClick={() => setDossierToDelete(dossier)}
                                    className="text-slate-400 hover:text-red-600 p-1 rounded-full transition-colors"
                                    aria-label={`Borrar dossier ${dossier.eventName}`}
                                >
                                    <Trash2 size={18} />
                                </button>
                             )}
                         </div>
                    </div>
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

        <DeleteConfirmationModal
            isOpen={!!dossierToDelete}
            onClose={handleCloseDeleteModal}
            onConfirm={handleDeleteDossier}
            dossierName={dossierToDelete?.eventName || ''}
            isLoading={isDeleteLoading}
            error={deleteError}
        />
    </div>
  );
};

export default Dashboard;