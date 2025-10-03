import React, { useState, useEffect, useCallback, ChangeEvent } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Dossier, Support, Evidence } from '../types';
import { DossierStatus, EvidenceType } from '../types';
import { SUPPORT_TYPES } from '../constants';
import Spinner from './Spinner';
import { GoogleGenAI } from '@google/genai';
import { ArrowLeft, Paperclip, Link as LinkIcon, Upload, X, Plus, Trash2, Sparkles, AlertTriangle, CheckCircle, Clock, FileText } from 'lucide-react';
import { useApiKey } from '../context/ApiKeyContext';

const statusStyles: { [key in DossierStatus]: { container: string, text: string } } = {
    [DossierStatus.DRAFT]: { container: 'border-yellow-300 bg-yellow-50', text: 'text-yellow-700' },
    [DossierStatus.SUBMITTED]: { container: 'border-blue-300 bg-blue-50', text: 'text-blue-700' },
    [DossierStatus.APPROVED]: { container: 'border-green-300 bg-green-50', text: 'text-green-700' },
    [DossierStatus.REJECTED]: { container: 'border-red-300 bg-red-50', text: 'text-red-700' },
};

const EvidenceAnalysis: React.FC<{ analysis: Evidence['analysis'] }> = ({ analysis }) => {
    if (!analysis) return null;

    switch (analysis.status) {
        case 'pending':
            return <div className="flex items-center space-x-2 text-xs text-slate-500 mt-2"><Clock size={14} className="animate-spin" /><span>Analizando...</span></div>;
        case 'completed':
            return (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex items-center space-x-2 text-xs font-bold text-green-700 mb-1">
                        <CheckCircle size={14} /><span>Análisis completado</span>
                    </div>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{analysis.result}</p>
                </div>
            );
        case 'failed':
            return (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-center space-x-2 text-xs font-bold text-red-700 mb-1">
                        <AlertTriangle size={14} /><span>Análisis fallido</span>
                    </div>
                    <p className="text-sm text-slate-700">{analysis.result}</p>
                </div>
            );
        default:
            return null;
    }
};


const DossierDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { apiKey, apiKeyError } = useApiKey();
    const [dossier, setDossier] = useState<Dossier | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState<string | null>(null);
    const [analyzing, setAnalyzing] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (!id) {
            setError("No dossier ID provided.");
            setLoading(false);
            return;
        }

        const dossierRef = doc(db, 'dossiers', id);
        const unsubscribe = onSnapshot(dossierRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Omit<Dossier, 'id'>;
                // Basic validation for user access
                if (currentUser && data.userId === currentUser.uid) {
                    setDossier({ id: docSnap.id, ...data });
                    setError(null);
                } else {
                    setError("No tienes permiso para ver este dossier.");
                }
            } else {
                setError("Dossier no encontrado.");
            }
            setLoading(false);
        }, (err) => {
            console.error("Error fetching dossier:", err);
            setError("Error al cargar el dossier.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [id, currentUser]);

    const updateSupports = async (newSupports: Support[]) => {
        if (!dossier) return;
        try {
            const dossierRef = doc(db, 'dossiers', dossier.id);
            await updateDoc(dossierRef, { supports: newSupports });
        } catch (err) {
            console.error("Error updating supports:", err);
            alert("Error al guardar los cambios. Inténtalo de nuevo.");
        }
    };

    const handleAddSupport = (supportType: string) => {
        if (!dossier || dossier.supports.some(s => s.type === supportType)) return;
        const newSupport: Support = {
            id: Date.now().toString(),
            type: supportType,
            evidences: []
        };
        const newSupports = [...dossier.supports, newSupport];
        updateSupports(newSupports);
    };

    const handleRemoveSupport = (supportId: string) => {
        if (!dossier) return;
        const newSupports = dossier.supports.filter(s => s.id !== supportId);
        updateSupports(newSupports);
    };

    const handleAddEvidence = async (supportId: string, type: EvidenceType, value: string | File) => {
        if (!dossier) return;
        const originalSupports = dossier.supports;

        // Check for duplicate URL before anything else
        if (type === EvidenceType.URL) {
            const url = value as string;
            const targetSupport = dossier.supports.find(s => s.id === supportId);
            if (targetSupport?.evidences.some(e => e.type === EvidenceType.URL && e.value === url)) {
                alert('Esta URL ya ha sido añadida como evidencia.');
                return; // Exit the function if a duplicate is found
            }
        }

        setIsUploading(supportId);
        
        try {
            let evidenceValue = '';
            let fileName: string | undefined = undefined;

            if (type === EvidenceType.URL) {
                evidenceValue = value as string;
            } else if (type === EvidenceType.IMAGE && value instanceof File) {
                const file = value;
                fileName = file.name;
                const storageRef = ref(storage, `dossiers/${dossier.id}/${supportId}/${Date.now()}_${file.name}`);
                await uploadBytes(storageRef, file);
                evidenceValue = await getDownloadURL(storageRef);
            }

            const newEvidence: Evidence = {
                id: Date.now().toString(),
                type,
                value: evidenceValue,
            };

            if (fileName) {
                newEvidence.fileName = fileName;
            }

            const newSupports = dossier.supports.map(s => {
                if (s.id === supportId) {
                    return { ...s, evidences: [...s.evidences, newEvidence] };
                }
                return s;
            });
            
            // Optimistic UI update
            setDossier(prev => prev ? { ...prev, supports: newSupports } : null);

            await updateSupports(newSupports);
        } catch (err) {
            console.error("Error adding evidence:", err);
            alert("Ocurrió un error al añadir la evidencia. Se restaurará el estado anterior.");
            // Revert on failure
            setDossier(prev => prev ? { ...prev, supports: originalSupports } : null);
        } finally {
            setIsUploading(null);
        }
    };

    const handleRemoveEvidence = async (supportId: string, evidenceId: string) => {
        if (!dossier) return;
        
        const support = dossier.supports.find(s => s.id === supportId);
        const evidence = support?.evidences.find(e => e.id === evidenceId);

        if (evidence?.type === EvidenceType.IMAGE) {
            try {
                const imageRef = ref(storage, evidence.value);
                await deleteObject(imageRef);
            } catch (err) {
                console.error("Could not delete file from storage, it might not exist:", err);
            }
        }

        const newSupports = dossier.supports.map(s => {
            if (s.id === supportId) {
                return { ...s, evidences: s.evidences.filter(e => e.id !== evidenceId) };
            }
            return s;
        });

        updateSupports(newSupports);
    };

    const handleAnalyzeEvidence = async (supportId: string, evidenceId: string) => {
        if (!dossier) return;
        
        const support = dossier.supports.find(s => s.id === supportId);
        const evidence = support?.evidences.find(e => e.id === evidenceId);

        if (!evidence || evidence.type !== EvidenceType.IMAGE) return;

        setAnalyzing(prev => ({ ...prev, [evidenceId]: true }));

        const optimisticSupports = dossier.supports.map(s => s.id === supportId ? {
            ...s, evidences: s.evidences.map(ev => ev.id === evidenceId ? { ...ev, analysis: { status: 'pending' as 'pending', result: '', timestamp: serverTimestamp() } } : ev)
        } : s);
        await updateSupports(optimisticSupports);

        if (!apiKey) {
            console.error("API Key not available for analysis.");
            const errorSupports = dossier.supports.map(s => s.id === supportId ? {
                ...s, evidences: s.evidences.map(ev => ev.id === evidenceId ? { ...ev, analysis: { status: 'failed' as 'failed', result: `Análisis fallido: ${apiKeyError || 'La clave de API no está configurada.'}`, timestamp: serverTimestamp() } } : ev)
            } : s);
            await updateSupports(errorSupports);
            setAnalyzing(prev => ({ ...prev, [evidenceId]: false }));
            return;
        }

        try {
            const ai = new GoogleGenAI({ apiKey });
            
            const response = await fetch(evidence.value);
            const blob = await response.blob();

            const base64String = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            const imagePart = { inlineData: { mimeType: blob.type, data: base64String } };
            const textPart = { text: `Analiza esta imagen para verificar la presencia de material de patrocinio de la "Diputación de Málaga". Busca logotipos, pancartas u otras menciones explícitas. Proporciona un resumen breve y concluyente en español.` };

            const genAIResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart, textPart] },
            });
            
            const analysisResult = genAIResponse.text;
            
            const dossierRef = doc(db, 'dossiers', dossier.id);
            const docSnap = await getDoc(dossierRef);
            const latestSupports = docSnap.exists() ? (docSnap.data() as Dossier).supports : dossier.supports;

            const finalSupports = latestSupports.map(s => s.id === supportId ? {
                ...s, evidences: s.evidences.map(ev => ev.id === evidenceId ? { ...ev, analysis: { status: 'completed' as 'completed', result: analysisResult, timestamp: serverTimestamp() } } : ev)
            } : s);
            await updateSupports(finalSupports);

        } catch (err) {
            console.error("Error analyzing evidence:", err);
            const errorMessage = (err as Error).message;
            const userFriendlyError = `Análisis fallido: ${errorMessage}`;
            
            const dossierRef = doc(db, 'dossiers', dossier.id);
            const docSnap = await getDoc(dossierRef);
            const latestSupports = docSnap.exists() ? (docSnap.data() as Dossier).supports : dossier.supports;

            const errorSupports = latestSupports.map(s => s.id === supportId ? {
                ...s, evidences: s.evidences.map(ev => ev.id === evidenceId ? { ...ev, analysis: { status: 'failed' as 'failed', result: userFriendlyError, timestamp: serverTimestamp() } } : ev)
            } : s);
            await updateSupports(errorSupports);
        } finally {
            setAnalyzing(prev => ({ ...prev, [evidenceId]: false }));
        }
    };
    
    const handleSubmitDossier = async () => {
        if (!dossier) return;
        setIsSubmitting(true);
        try {
            const dossierRef = doc(db, 'dossiers', dossier.id);
            await updateDoc(dossierRef, { status: DossierStatus.SUBMITTED });
            navigate('/');
        } catch (err) {
            console.error("Error submitting dossier:", err);
            alert("Error al enviar el dossier.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div className="flex justify-center items-center mt-16"><Spinner /></div>;
    if (error) return <div className="text-center py-10 text-red-600 bg-red-50 rounded-lg">{error}</div>;
    if (!dossier) return null;

    const availableSupportTypes = SUPPORT_TYPES.filter(type => !dossier.supports.some(s => s.type === type));

    return (
        <div className="max-w-4xl mx-auto">
            <RouterLink to="/" className="flex items-center space-x-2 text-sky-600 hover:underline mb-6">
                <ArrowLeft size={18} />
                <span>Volver al Dashboard</span>
            </RouterLink>

            <div className={`p-6 border-l-4 rounded-lg mb-8 ${statusStyles[dossier.status].container}`}>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">{dossier.eventName}</h1>
                        <p className="text-slate-500">{dossier.entityName} - {new Date(dossier.eventDate).toLocaleDateString('es-ES')}</p>
                    </div>
                    <span className={`text-sm font-bold px-3 py-1 rounded-full ${statusStyles[dossier.status].text} ${statusStyles[dossier.status].container.replace('border-l-4', '')}`}>
                        {dossier.status}
                    </span>
                </div>
            </div>
            
            {apiKeyError && <p className="mb-4 text-xs text-red-600 bg-red-50 p-2 rounded-md">{apiKeyError}</p>}

            <div className="space-y-6">
                {dossier.supports.map(support => (
                    <SupportCard 
                        key={support.id} 
                        support={support}
                        onAddEvidence={(type, value) => handleAddEvidence(support.id, type, value)}
                        onRemoveEvidence={(evidenceId) => handleRemoveEvidence(support.id, evidenceId)}
                        onRemoveSupport={() => handleRemoveSupport(support.id)}
                        onAnalyzeEvidence={(evidenceId) => handleAnalyzeEvidence(support.id, evidenceId)}
                        isUploading={isUploading === support.id}
                        analyzing={analyzing}
                        isEditable={dossier.status === DossierStatus.DRAFT}
                        apiKeyAvailable={!!apiKey}
                    />
                ))}
            </div>

            {dossier.status === DossierStatus.DRAFT && (
                <div className="mt-8 border-t pt-6 space-y-4">
                     {availableSupportTypes.length > 0 && (
                        <div className="bg-white p-4 rounded-lg shadow-sm">
                           <h3 className="font-semibold text-slate-700 mb-2">Añadir nuevo soporte</h3>
                            <div className="flex flex-wrap gap-2">
                                {availableSupportTypes.map(type => (
                                    <button key={type} onClick={() => handleAddSupport(type)} className="flex items-center space-x-2 text-sm bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md transition">
                                        <Plus size={16} />
                                        <span>{type}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end">
                        <button onClick={handleSubmitDossier} disabled={isSubmitting} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-6 rounded-lg transition flex items-center">
                           {isSubmitting && <Spinner className="h-5 w-5 mr-2" />}
                           Enviar Dossier para Revisión
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

interface SupportCardProps {
    support: Support;
    onAddEvidence: (type: EvidenceType, value: string | File) => void;
    onRemoveEvidence: (evidenceId: string) => void;
    onRemoveSupport: () => void;
    onAnalyzeEvidence: (evidenceId: string) => void;
    isUploading: boolean;
    analyzing: Record<string, boolean>;
    isEditable: boolean;
    apiKeyAvailable: boolean;
}

const SupportCard: React.FC<SupportCardProps> = ({ support, onAddEvidence, onRemoveEvidence, onRemoveSupport, onAnalyzeEvidence, isUploading, analyzing, isEditable, apiKeyAvailable }) => {
    const [showAddForm, setShowAddForm] = useState(false);
    const [evidenceType, setEvidenceType] = useState<EvidenceType>(EvidenceType.URL);
    const [urlValue, setUrlValue] = useState('');
    const [fileValue, setFileValue] = useState<File | null>(null);

    const handleAddClick = () => {
        if (!urlValue && !fileValue) return;
        if (evidenceType === EvidenceType.URL) onAddEvidence(EvidenceType.URL, urlValue);
        if (evidenceType === EvidenceType.IMAGE && fileValue) onAddEvidence(EvidenceType.IMAGE, fileValue);
        setUrlValue('');
        setFileValue(null);
        setShowAddForm(false);
    };

    return (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-semibold text-slate-800">{support.type}</h3>
                {isEditable && (
                     <button onClick={onRemoveSupport} className="text-slate-400 hover:text-red-600 transition">
                        <Trash2 size={18} />
                    </button>
                )}
            </div>
            <div className="p-5 space-y-4">
                {support.evidences.length === 0 && !showAddForm && (
                     <div className="text-center py-4 text-slate-500">
                        <FileText size={32} className="mx-auto text-slate-300" />
                        <p className="mt-2 text-sm">No hay evidencias para este soporte.</p>
                     </div>
                )}
                {support.evidences.map(evidence => (
                    <div key={evidence.id} className="p-3 bg-slate-50 rounded-md border">
                        <div className="flex justify-between items-start">
                            <div className="flex items-center space-x-3 break-all">
                                {evidence.type === EvidenceType.URL ? <LinkIcon size={18} className="text-sky-600 flex-shrink-0" /> : <Paperclip size={18} className="text-sky-600 flex-shrink-0" />}
                                <a href={evidence.value} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-700 hover:underline">
                                    {evidence.type === EvidenceType.URL ? evidence.value : evidence.fileName}
                                </a>
                            </div>
                           {isEditable && <button onClick={() => onRemoveEvidence(evidence.id)} className="text-slate-400 hover:text-red-500 ml-2 flex-shrink-0"><X size={16} /></button>}
                        </div>
                        {evidence.type === EvidenceType.IMAGE && (
                            <>
                                <img src={evidence.value} alt={evidence.fileName} className="mt-3 rounded-md max-h-60 object-contain border" />
                                <EvidenceAnalysis analysis={evidence.analysis} />
                                {isEditable && !evidence.analysis && (
                                    <button 
                                        onClick={() => onAnalyzeEvidence(evidence.id)} 
                                        disabled={analyzing[evidence.id] || !apiKeyAvailable}
                                        className="mt-3 flex items-center space-x-2 text-sm bg-sky-100 text-sky-700 hover:bg-sky-200 font-semibold py-1 px-3 rounded-md transition disabled:bg-slate-200 disabled:text-slate-500 disabled:cursor-not-allowed"
                                        title={!apiKeyAvailable ? "La funcionalidad de IA no está disponible debido a un problema de configuración." : "Analizar con IA"}
                                    >
                                        {analyzing[evidence.id] ? <Spinner className="h-4 w-4" /> : <Sparkles size={16} />}
                                        <span>Analizar con IA</span>
                                    </button>
                                )}
                            </>
                        )}
                    </div>
                ))}

                {isEditable && (
                    <>
                        {showAddForm && (
                            <div className="pt-4 border-t">
                                <div className="flex space-x-2 mb-3">
                                    <button onClick={() => setEvidenceType(EvidenceType.URL)} className={`px-3 py-1.5 text-sm rounded-md ${evidenceType === EvidenceType.URL ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Enlace</button>
                                    <button onClick={() => setEvidenceType(EvidenceType.IMAGE)} className={`px-3 py-1.5 text-sm rounded-md ${evidenceType === EvidenceType.IMAGE ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-700'}`}>Imagen</button>
                                </div>
                                {evidenceType === EvidenceType.URL ? (
                                    <input type="url" value={urlValue} onChange={e => setUrlValue(e.target.value)} placeholder="https://ejemplo.com" className="w-full px-3 py-2 border rounded-md" />
                                ) : (
                                    <input type="file" accept="image/*" onChange={(e: ChangeEvent<HTMLInputElement>) => setFileValue(e.target.files ? e.target.files[0] : null)} className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100" />
                                )}
                                <div className="flex justify-end space-x-2 mt-3">
                                    <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-sm bg-slate-100 rounded-md">Cancelar</button>
                                    <button onClick={handleAddClick} disabled={isUploading} className="px-3 py-1.5 text-sm bg-sky-600 text-white rounded-md flex items-center">
                                        {isUploading ? <Spinner className="h-4 w-4 mr-2" /> : null}
                                        Añadir
                                    </button>
                                </div>
                            </div>
                        )}
                        {!showAddForm && (
                             <button onClick={() => setShowAddForm(true)} className="w-full flex justify-center items-center space-x-2 py-2 border-2 border-dashed rounded-lg text-slate-500 hover:bg-slate-50 hover:border-slate-400 transition">
                                <Plus size={18} />
                                <span>Añadir Evidencia</span>
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default DossierDetail;