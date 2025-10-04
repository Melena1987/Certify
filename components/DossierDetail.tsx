
import React, { useState, useEffect, ChangeEvent } from 'react';
import { useParams, Link as RouterLink, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../context/AuthContext';
import type { Dossier, Support, Evidence } from '../types';
import { DossierStatus, EvidenceType, SupportStatus } from '../types';
import { SUPPORT_TYPES } from '../constants';
import Spinner from './Spinner';
import { ArrowLeft, Paperclip, Link as LinkIcon, X, Plus, Trash2, FileText, ChevronRight, ChevronDown, CheckCircle, Flag, Download } from 'lucide-react';
import { useApiKey } from '../context/ApiKeyContext';

const dossierStatusStyles: { [key in DossierStatus]: { container: string, text: string } } = {
    [DossierStatus.DRAFT]: { container: 'border-yellow-300 bg-yellow-50', text: 'text-yellow-700' },
    [DossierStatus.SUBMITTED]: { container: 'border-blue-300 bg-blue-50', text: 'text-blue-700' },
    [DossierStatus.APPROVED]: { container: 'border-green-300 bg-green-50', text: 'text-green-700' },
    [DossierStatus.REJECTED]: { container: 'border-red-300 bg-red-50', text: 'text-red-700' },
};

const supportStatusStyles: { [key in SupportStatus]: { badge: string } } = {
    [SupportStatus.PENDING]: { badge: 'bg-slate-100 text-slate-600' },
    [SupportStatus.APPROVED]: { badge: 'bg-green-100 text-green-700' },
    [SupportStatus.REJECTED]: { badge: 'bg-red-100 text-red-700' },
};

const DossierDetail: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const userRole = currentUser?.profile?.role;
    const { apiKeyError } = useApiKey();
    const [dossier, setDossier] = useState<Dossier | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState<string | null>(null);
    const [evidenceError, setEvidenceError] = useState<Record<string, string | null>>({});
    const [viewingImage, setViewingImage] = useState<string | null>(null);
    const [rejectionModal, setRejectionModal] = useState<{ isOpen: boolean; supportId: string | null }>({ isOpen: false, supportId: null });
    const [rejectionReason, setRejectionReason] = useState('');
    const [customSupportType, setCustomSupportType] = useState('');
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);


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
                if (currentUser && (data.userId === currentUser.uid || userRole === 'DIPUTACION')) {
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
    }, [id, currentUser, userRole]);

    const updateDossier = async (updates: Partial<Dossier>) => {
        if (!dossier) return;
        try {
            const dossierRef = doc(db, 'dossiers', dossier.id);
            await updateDoc(dossierRef, updates);
        } catch (err) {
            console.error("Error updating dossier:", err);
            alert("Error al guardar los cambios. Inténtalo de nuevo.");
        }
    };
    
    const determineDossierStatus = (supports: Support[], currentStatus: DossierStatus): DossierStatus => {
        if (currentStatus !== DossierStatus.SUBMITTED && currentStatus !== DossierStatus.APPROVED) {
            return currentStatus;
        }

        if (supports.length > 0 && supports.every(s => s.status === SupportStatus.APPROVED)) {
            return DossierStatus.APPROVED;
        }
        
        if (currentStatus === DossierStatus.APPROVED) {
            return DossierStatus.SUBMITTED;
        }

        return currentStatus;
    };

    const handleAddSupport = (supportType: string) => {
        if (!dossier) return;
        const trimmedType = supportType.trim();
        // Case-insensitive check to prevent duplicates
        if (!trimmedType || dossier.supports.some(s => s.type.toLowerCase() === trimmedType.toLowerCase())) {
            return;
        }
    
        const newSupport: Support = {
            id: Date.now().toString(),
            type: trimmedType,
            evidences: [],
            status: SupportStatus.PENDING,
        };
        const newSupports = [...dossier.supports, newSupport];
        updateDossier({ supports: newSupports });
    };

    const handleAddCustomSupport = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedType = customSupportType.trim();
        if (trimmedType) {
            handleAddSupport(trimmedType);
            setCustomSupportType('');
        }
    };

    const handleRemoveSupport = (supportId: string) => {
        if (!dossier) return;
        const newSupports = dossier.supports.filter(s => s.id !== supportId);
        updateDossier({ supports: newSupports });
    };

    const handleUpdateSupportStatus = (supportId: string, status: SupportStatus, reason: string = '') => {
        if (!dossier) return;

        const updatedSupports = dossier.supports.map(s => {
            if (s.id === supportId) {
                return { ...s, status, rejectionReason: status === SupportStatus.APPROVED ? '' : reason };
            }
            return s;
        });

        const updates: Partial<Dossier> = { supports: updatedSupports };
        
        const newDossierStatus = determineDossierStatus(updatedSupports, dossier.status);
        if (newDossierStatus !== dossier.status) {
            updates.status = newDossierStatus;
        }

        updateDossier(updates);
    };


    const handleAddEvidence = async (supportId: string, type: EvidenceType, value: string | File) => {
        if (!dossier) return;
        
        const setSupportError = (message: string | null) => {
            setEvidenceError(prev => ({ ...prev, [supportId]: message }));
        };

        setSupportError(null);

        const supportIndex = dossier.supports.findIndex(s => s.id === supportId);
        if (supportIndex === -1) return;

        let newEvidence: Evidence | null = null;

        if (type === EvidenceType.URL) {
            if (typeof value !== 'string' || !value.trim()) {
                setSupportError('La URL no puede estar vacía.');
                return;
            }
            const trimmedValue = value.trim();
            if (!/^(https?:\/\/)/.test(trimmedValue)) {
                setSupportError('Introduce una URL válida (ej: http://...)');
                return;
            }
            
            const currentSupport = dossier.supports[supportIndex];
            if (currentSupport.evidences.some(e => e.type === EvidenceType.URL && e.value === trimmedValue)) {
                setSupportError('Esta URL ya ha sido añadida.');
                return;
            }

            newEvidence = {
                id: Date.now().toString(),
                type: EvidenceType.URL,
                value: trimmedValue,
            };
        } else if (type === EvidenceType.IMAGE && value instanceof File) {
            setIsUploading(supportId);
            try {
                const fileRef = ref(storage, `dossiers/${dossier.id}/${supportId}/${Date.now()}-${value.name}`);
                const snapshot = await uploadBytes(fileRef, value);
                
                // Retry logic for getDownloadURL to handle permission propagation delays
                let downloadURL = '';
                let attempts = 3;
                while (attempts > 0) {
                    try {
                        downloadURL = await getDownloadURL(snapshot.ref);
                        break; // Success
                    } catch (urlError) {
                        attempts--;
                        if (attempts === 0) throw urlError; // Rethrow last error
                        await new Promise(res => setTimeout(res, 500 * (4 - attempts))); // Exponential backoff
                    }
                }

                newEvidence = {
                    id: Date.now().toString(),
                    type: EvidenceType.IMAGE,
                    value: downloadURL,
                    fileName: value.name
                };
            } catch (err) {
                console.error("Error uploading file:", err);
                setSupportError('Error al subir la imagen.');
            } finally {
                setIsUploading(null);
            }
        }

        if (newEvidence) {
            const newSupports = [...dossier.supports];
            newSupports[supportIndex].evidences.push(newEvidence);
            await updateDossier({ supports: newSupports });
        }
    };

    const handleRemoveEvidence = async (supportId: string, evidenceId: string) => {
        if (!dossier) return;

        const supportIndex = dossier.supports.findIndex(s => s.id === supportId);
        if (supportIndex === -1) return;

        const support = dossier.supports[supportIndex];
        const evidenceToRemove = support.evidences.find(e => e.id === evidenceId);

        if (!evidenceToRemove) return;

        // Delete from storage if it's an image
        if (evidenceToRemove.type === EvidenceType.IMAGE) {
            try {
                const imageRef = ref(storage, evidenceToRemove.value);
                await deleteObject(imageRef);
            } catch (error: any) {
                if (error.code !== 'storage/object-not-found') {
                    console.error("Error deleting evidence file:", error);
                    alert("No se pudo borrar el archivo de la evidencia. Por favor, inténtalo de nuevo.");
                    return;
                }
            }
        }

        const newEvidences = support.evidences.filter(e => e.id !== evidenceId);
        const newSupports = [...dossier.supports];
        newSupports[supportIndex] = { ...support, evidences: newEvidences };

        await updateDossier({ supports: newSupports });
    };

    const handleSubmitDossier = async () => {
        if (!dossier) return;
        setIsSubmitting(true);
        try {
            await updateDossier({ status: DossierStatus.SUBMITTED });
            navigate('/');
        } catch (err) {
            console.error("Error submitting dossier:", err);
            alert("Error al enviar el dossier.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOpenRejectionModal = (supportId: string) => {
        setRejectionModal({ isOpen: true, supportId });
    };
    
    const handleCloseRejectionModal = () => {
        setRejectionModal({ isOpen: false, supportId: null });
        setRejectionReason('');
    };

    const handleConfirmRejection = () => {
        if (rejectionModal.supportId && rejectionReason) {
            handleUpdateSupportStatus(rejectionModal.supportId, SupportStatus.REJECTED, rejectionReason);
            handleCloseRejectionModal();
        }
    };

    const handleDownloadPdf = async () => {
        if (!dossier) return;

        setIsGeneratingPdf(true);

        let htmlContent = `
            <html>
            <head>
                <title>Dossier: ${dossier.eventName}</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; margin: 2rem; color: #334155; }
                    h1, h2, h3 { color: #0284c7; }
                    h1 { font-size: 2rem; }
                    h2 { font-size: 1.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; margin-top: 2.5rem; }
                    h3 { font-size: 1.2rem; margin-top: 1.5rem; }
                    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #cbd5e1; padding-bottom: 1rem; }
                    .logo { height: 48px; }
                    .details { background-color: #f1f5f9; padding: 1.5rem; border-radius: 0.5rem; margin-top: 1rem; }
                    .support-card { page-break-inside: avoid; margin-bottom: 1.5rem; }
                    .evidence-list { list-style: none; padding-left: 0; }
                    .evidence-item { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
                    .evidence-item a { color: #0369a1; text-decoration: none; word-break: break-all; }
                    .evidence-item a:hover { text-decoration: underline; }
                    .image-container { margin-top: 1rem; }
                    .evidence-image { max-width: 200px; max-height: 200px; border: 1px solid #e2e8f0; border-radius: 0.25rem; margin-bottom: 0.5rem; }
                    @media print {
                        body { margin: 1rem; }
                        .no-print { display: none; }
                        h2 { margin-top: 2rem; }
                    }
                </style>
            </head>
            <body>
                <header class="header">
                     <div style="display: flex; align-items: center; gap: 1rem;">
                        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                        <span style="font-size: 1.5rem; font-weight: bold; color: #1e293b;">Certify</span>
                     </div>
                     <img class="logo" src="https://firebasestorage.googleapis.com/v0/b/certify-diputacion.firebasestorage.app/o/recursos%2Fmarca_mlg_compite_diputacion_monocromatico_azul.png?alt=media&token=f2295896-b2f4-44c2-a3f8-8f895e994eb8" alt="Logo Diputación de Málaga" />
                </header>

                <h1>Dossier de Justificación</h1>
                <div class="details">
                    <p><strong>Evento:</strong> ${dossier.eventName}</p>
                    <p><strong>Entidad:</strong> ${dossier.entityName}</p>
                    <p><strong>Fecha del Evento:</strong> ${new Date(dossier.eventDate).toLocaleDateString('es-ES')}</p>
                    <p><strong>Estado:</strong> ${dossier.status}</p>
                </div>
        `;

        for (const support of dossier.supports) {
            htmlContent += `
                <div class="support-card">
                    <h2>Soporte: ${support.type}</h2>
            `;
            const urlEvidences = support.evidences.filter(e => e.type === 'url');
            const imageEvidences = support.evidences.filter(e => e.type === 'image');
            if (support.evidences.length === 0) {
                 htmlContent += '<p style="color: #64748b;">No se han adjuntado evidencias para este soporte.</p>';
            }
            if (urlEvidences.length > 0) {
                htmlContent += '<h3>Enlaces</h3><ul class="evidence-list">';
                urlEvidences.forEach(e => {
                    htmlContent += `<li class="evidence-item"><a href="${e.value}" target="_blank">${e.value}</a></li>`;
                });
                htmlContent += '</ul>';
            }
            if (imageEvidences.length > 0) {
                htmlContent += '<h3>Imágenes</h3>';
                imageEvidences.forEach(e => {
                    htmlContent += `<div class="image-container"><img src="${e.value}" class="evidence-image" alt="${e.fileName || 'Evidencia'}"/></div>`;
                });
            }
            htmlContent += `</div>`;
        }

        htmlContent += `</body></html>`;
        
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
                setIsGeneratingPdf(false);
            }, 1000); // Delay to allow images to load
        } else {
            alert("No se pudo abrir la ventana de impresión. Por favor, deshabilita el bloqueador de pop-ups.");
            setIsGeneratingPdf(false);
        }
    };


    if (loading) return <div className="flex justify-center items-center mt-16"><Spinner /></div>;
    if (error) return <div className="text-center py-10 text-red-600 bg-red-50 rounded-lg">{error}</div>;
    if (!dossier) return null;

    // Defensively get status styles, defaulting to DRAFT if status is invalid
    const statusStyle = dossierStatusStyles[dossier.status] || dossierStatusStyles[DossierStatus.DRAFT];
    const availableSupportTypes = SUPPORT_TYPES.filter(type => !dossier.supports.some(s => s.type === type));
    const backLink = userRole === 'DIPUTACION' ? '/admin' : '/';

    return (
        <div className="max-w-4xl mx-auto">
            <RouterLink to={backLink} className="flex items-center space-x-2 text-sky-600 hover:underline mb-6">
                <ArrowLeft size={18} />
                <span>Volver al Panel</span>
            </RouterLink>

            <div className={`p-6 border-l-4 rounded-lg mb-8 ${statusStyle.container}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-800">{dossier.eventName}</h1>
                        <p className="text-slate-500">{dossier.entityName} - {new Date(dossier.eventDate).toLocaleDateString('es-ES')}</p>
                    </div>
                     <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full sm:w-auto">
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${statusStyle.text} ${statusStyle.container.replace('border-l-4', '')} self-start sm:self-center`}>
                            {dossier.status}
                        </span>
                        {dossier.status === DossierStatus.APPROVED && (
                            <button
                                onClick={handleDownloadPdf}
                                disabled={isGeneratingPdf}
                                className="flex items-center justify-center space-x-2 bg-sky-600 text-white py-2 px-4 rounded-lg shadow-md hover:bg-sky-700 transition disabled:bg-slate-400 w-full sm:w-auto"
                            >
                                {isGeneratingPdf ? <Spinner className="h-5 w-5"/> : <Download size={18} />}
                                <span>{isGeneratingPdf ? 'Generando...' : 'Descargar PDF'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            {apiKeyError && <p className="mb-4 text-xs text-red-600 bg-red-50 p-2 rounded-md">{apiKeyError}</p>}

            <div className="space-y-6">
                {dossier.supports.map(support => (
                    <SupportCard 
                        key={support.id} 
                        support={support}
                        userRole={userRole}
                        onAddEvidence={(type, value) => handleAddEvidence(support.id, type, value)}
                        onRemoveEvidence={(evidenceId) => handleRemoveEvidence(support.id, evidenceId)}
                        onRemoveSupport={() => handleRemoveSupport(support.id)}
                        onUpdateStatus={handleUpdateSupportStatus}
                        onRejectWithReason={() => handleOpenRejectionModal(support.id)}
                        isUploading={isUploading === support.id}
                        isEditable={dossier.status === DossierStatus.DRAFT && userRole === 'ENTITY'}
                        isReviewable={dossier.status === DossierStatus.SUBMITTED && userRole === 'DIPUTACION'}
                        evidenceError={evidenceError[support.id] || null}
                        onViewImage={setViewingImage}
                    />
                ))}
            </div>

            {dossier.status === DossierStatus.DRAFT && userRole === 'ENTITY' && (
                 <div className="mt-8 border-t pt-6 space-y-4">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                        <h3 className="font-semibold text-slate-700 mb-4">Añadir nuevo soporte</h3>
                        {availableSupportTypes.length > 0 && (
                            <div className="mb-4">
                                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 tracking-wider">Sugerencias</h4>
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
                        <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 tracking-wider">Soporte Personalizado</h4>
                            <form onSubmit={handleAddCustomSupport} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={customSupportType}
                                    onChange={(e) => setCustomSupportType(e.target.value)}
                                    placeholder="Ej: Mención en entrevista, flyer, etc."
                                    className="flex-grow w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-1 focus:ring-sky-500"
                                    required
                                />
                                <button type="submit" className="bg-slate-600 hover:bg-slate-700 text-white font-semibold text-sm px-4 py-1.5 rounded-md transition whitespace-nowrap flex items-center gap-2">
                                    <Plus size={16} />
                                    <span>Añadir</span>
                                </button>
                            </form>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button onClick={handleSubmitDossier} disabled={isSubmitting} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-6 rounded-lg transition flex items-center">
                           {isSubmitting && <Spinner className="h-5 w-5 mr-2" />}
                           Enviar Dossier para Revisión
                        </button>
                    </div>
                </div>
            )}
             {viewingImage && (
                <ImagePreviewModal imageUrl={viewingImage} onClose={() => setViewingImage(null)} />
            )}
            <RejectionModal 
                isOpen={rejectionModal.isOpen}
                onClose={handleCloseRejectionModal}
                onConfirm={handleConfirmRejection}
                reason={rejectionReason}
                setReason={setRejectionReason}
            />
        </div>
    );
};

interface SupportCardProps {
    support: Support;
    userRole?: 'ENTITY' | 'DIPUTACION';
    onAddEvidence: (type: EvidenceType, value: string | File) => void;
    onRemoveEvidence: (evidenceId: string) => void;
    onRemoveSupport: () => void;
    onUpdateStatus: (supportId: string, status: SupportStatus) => void;
    onRejectWithReason: () => void;
    isUploading: boolean;
    isEditable: boolean;
    isReviewable: boolean;
    evidenceError: string | null;
    onViewImage: (url: string) => void;
}

const SupportCard: React.FC<SupportCardProps> = (props) => {
    const { support, userRole, onAddEvidence, onRemoveEvidence, onRemoveSupport, onUpdateStatus, onRejectWithReason, isUploading, isEditable, isReviewable, evidenceError, onViewImage } = props;
    const [isCollapsed, setIsCollapsed] = useState(support.status === SupportStatus.APPROVED);
    const [urlValue, setUrlValue] = useState('');

    useEffect(() => {
        if (support.status === SupportStatus.APPROVED) {
            setIsCollapsed(true);
        }
    }, [support.status]);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            onAddEvidence(EvidenceType.IMAGE, e.target.files[0]);
            e.target.value = ''; // Reset file input
        }
    };
    
    const handleAddUrl = (e: React.FormEvent) => {
        e.preventDefault();
        if (urlValue.trim()) {
            onAddEvidence(EvidenceType.URL, urlValue);
            setUrlValue('');
        }
    };
    
    // Defensively get status styles, defaulting to PENDING if status is invalid
    const statusInfo = supportStatusStyles[support.status] || supportStatusStyles[SupportStatus.PENDING];

    const urlEvidences = support.evidences.filter(e => e.type === EvidenceType.URL);
    const imageEvidences = support.evidences.filter(e => e.type === EvidenceType.IMAGE);

    return (
         <div className="bg-white rounded-lg shadow-sm transition-shadow duration-300 hover:shadow-md">
            <div className="p-4 border-b flex justify-between items-center cursor-pointer" onClick={() => setIsCollapsed(!isCollapsed)}>
                <div className="flex items-center space-x-3">
                     <span className={`p-1.5 rounded-full ${statusInfo.badge}`}>
                        {isCollapsed ? <ChevronRight size={20} /> : <ChevronDown size={20} />}
                    </span>
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800">{support.type}</h2>
                        {support.status === SupportStatus.REJECTED && support.rejectionReason && (
                           <p className="text-sm text-red-600 mt-1"><strong>Motivo:</strong> {support.rejectionReason}</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    {isEditable && (
                        <button onClick={(e) => { e.stopPropagation(); onRemoveSupport(); }} className="text-slate-400 hover:text-red-600 transition p-1 rounded-full"><Trash2 size={18} /></button>
                    )}
                </div>
            </div>
            
            {!isCollapsed && (
                 <div className="p-4 space-y-4">
                    {support.evidences.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No hay evidencias para este soporte.</p>
                    ) : (
                        <div className="space-y-4">
                             {urlEvidences.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 tracking-wider">Enlaces</h4>
                                    <ul className="space-y-2">
                                        {urlEvidences.map(evidence => (
                                            <li key={evidence.id} className="flex items-center justify-between bg-slate-50 p-2 rounded-md group">
                                                <div className="flex items-center space-x-2 overflow-hidden">
                                                    <LinkIcon size={16} className="text-slate-500 flex-shrink-0" />
                                                    <a href={evidence.value} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-600 hover:underline truncate" title={evidence.value}>
                                                        {evidence.value}
                                                    </a>
                                                </div>
                                                {isEditable && (
                                                    <button onClick={() => onRemoveEvidence(evidence.id)} className="text-slate-400 hover:text-red-600 p-1 rounded-full flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"><X size={16} /></button>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {imageEvidences.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2 tracking-wider">Imágenes</h4>
                                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
                                        {imageEvidences.map(evidence => (
                                            <div key={evidence.id} className="relative group aspect-square">
                                                <button onClick={() => onViewImage(evidence.value)} className="w-full h-full rounded-md overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-transform duration-200 group-hover:scale-105">
                                                    <img src={evidence.value} alt={evidence.fileName || 'Evidencia'} className="w-full h-full object-cover" loading="lazy" />
                                                </button>
                                                {isEditable && (
                                                    <button onClick={() => onRemoveEvidence(evidence.id)} className="absolute top-1 right-1 bg-black bg-opacity-50 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 focus:opacity-100" aria-label={`Eliminar imagen ${evidence.fileName}`}>
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {isEditable && (
                        <div className="border-t pt-4 space-y-3">
                           <h4 className="text-sm font-medium text-slate-600">Añadir evidencia</h4>
                            {evidenceError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-md">{evidenceError}</p>}
                            <form onSubmit={handleAddUrl} className="flex items-center gap-2">
                                <input type="url" value={urlValue} onChange={(e) => setUrlValue(e.target.value)} placeholder="https://ejemplo.com" className="flex-grow w-full px-3 py-1.5 border border-slate-300 rounded-md text-sm focus:ring-1 focus:ring-sky-500" />
                                <button type="submit" className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold text-sm px-3 py-1.5 rounded-md transition whitespace-nowrap">Añadir URL</button>
                            </form>
                             <div className="text-center text-sm text-slate-400">o</div>
                             <label className={`relative flex justify-center items-center w-full px-3 py-2 border-2 border-dashed border-slate-300 rounded-md cursor-pointer hover:bg-slate-50 transition ${isUploading ? 'opacity-50' : ''}`}>
                                {isUploading ? (
                                    <> <Spinner className="h-4 w-4 mr-2" /> <span>Subiendo...</span> </>
                                ) : (
                                    <> <Paperclip size={16} className="mr-2" /> <span>Subir Imagen</span> </>
                                )}
                                <input type="file" accept="image/png, image/jpeg, image/webp" onChange={handleFileChange} className="hidden" disabled={isUploading} />
                            </label>
                        </div>
                    )}

                    {isReviewable && (
                        <div className="border-t pt-4 flex justify-end space-x-2">
                            <button onClick={() => onUpdateStatus(support.id, SupportStatus.APPROVED)} className="flex items-center space-x-1 text-sm bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1.5 rounded-md transition">
                                <CheckCircle size={16} /><span>Aprobar</span>
                            </button>
                            <button onClick={onRejectWithReason} className="flex items-center space-x-1 text-sm bg-red-100 text-red-700 hover:bg-red-200 px-3 py-1.5 rounded-md transition">
                                <Flag size={16} /><span>Notificar Incidencia</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ImagePreviewModal: React.FC<{ imageUrl: string; onClose: () => void }> = ({ imageUrl, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 p-4" onClick={onClose}>
            <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <img src={imageUrl} alt="Vista previa de evidencia" className="object-contain max-w-full max-h-[90vh] rounded-lg" />
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 bg-white rounded-full p-1 text-slate-700 hover:bg-slate-200 transition"
                    aria-label="Cerrar vista previa"
                >
                    <X size={24} />
                </button>
            </div>
        </div>
    );
};


const RejectionModal: React.FC<{ isOpen: boolean; onClose: () => void; onConfirm: () => void; reason: string; setReason: (reason: string) => void; }> = ({ isOpen, onClose, onConfirm, reason, setReason }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Notificar Incidencia</h3>
                <p className="text-sm text-gray-500 mb-4">
                    Describe brevemente el motivo por el cual este soporte no es válido. La entidad verá este mensaje.
                </p>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full h-24 p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-sky-500"
                    placeholder="Ej: La imagen no muestra claramente el logo de la Diputación."
                />
                <div className="mt-5 flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200">Cancelar</button>
                    <button type="button" onClick={onConfirm} disabled={!reason.trim()} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300">Enviar Notificación</button>
                </div>
            </div>
        </div>
    );
}

export default DossierDetail;
