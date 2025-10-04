import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import type { Dossier, UserProfile } from '../types';
import { DossierStatus } from '../types';
import Spinner from './Spinner';
import { ArrowLeft, FileText, ChevronsRight, FolderCheck, FolderClock, FolderX } from 'lucide-react';

const statusConfig: { [key in DossierStatus]?: { title: string, icon: React.ElementType, iconClass: string } } = {
    [DossierStatus.SUBMITTED]: {
        title: "Pendientes de Revisión",
        icon: FolderClock,
        iconClass: "text-blue-500",
    },
    [DossierStatus.APPROVED]: {
        title: "Aprobados",
        icon: FolderCheck,
        iconClass: "text-green-500",
    },
    [DossierStatus.REJECTED]: {
        title: "Rechazados",
        icon: FolderX,
        iconClass: "text-red-500",
    },
    [DossierStatus.DRAFT]: {
        title: "Borradores",
        icon: FileText,
        iconClass: "text-yellow-500",
    }
};

const DossierStatusList: React.FC<{dossiers: Dossier[], status: DossierStatus}> = ({dossiers, status}) => {
    const config = statusConfig[status];
    if (!config) return null;

    const filteredDossiers = dossiers.filter(d => d.status === status);
    if (filteredDossiers.length === 0) return null;

    return (
        <div className="mb-8">
            <div className="flex items-center space-x-3 mb-4">
                <config.icon size={24} className={config.iconClass} />
                <h2 className="text-xl font-semibold text-slate-700">{config.title} ({filteredDossiers.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDossiers.map(dossier => (
                     <div key={dossier.id} className="bg-white p-6 rounded-lg shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">{dossier.eventName}</h3>
                            <p className="text-xs text-slate-400 mt-2">{new Date(dossier.eventDate).toLocaleDateString('es-ES')}</p>
                        </div>
                        <div className="border-t mt-4 pt-4">
                            <Link to={`/admin/dossier/${dossier.id}`} className="flex items-center text-sky-600 font-medium text-sm hover:underline">
                                <span>Ver Dossier</span>
                                <ChevronsRight size={18} className="ml-1"/>
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const EntityDossiers: React.FC = () => {
    const { entityId } = useParams<{ entityId: string }>();
    const [entity, setEntity] = useState<UserProfile | null>(null);
    const [dossiers, setDossiers] = useState<Dossier[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!entityId) {
            setError("No se ha proporcionado un ID de entidad.");
            setLoading(false);
            return;
        }

        const fetchEntityData = async () => {
            try {
                const entityRef = doc(db, 'users', entityId);
                const entitySnap = await getDoc(entityRef);
                if (entitySnap.exists()) {
                    setEntity(entitySnap.data() as UserProfile);
                } else {
                    setError("Entidad no encontrada.");
                }
            } catch (err) {
                console.error("Error fetching entity:", err);
                setError("Error al cargar los datos de la entidad.");
            }
        };

        fetchEntityData();

        const q = query(
            collection(db, 'dossiers'),
            where('userId', '==', entityId),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const dossiersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Dossier));
            setDossiers(dossiersData);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching dossiers for entity:", err);
            setError("Error al cargar los dossiers.");
            setLoading(false);
        });

        return () => unsubscribe();
    }, [entityId]);

    if (loading) return <div className="flex justify-center items-center mt-16"><Spinner /></div>;
    if (error) return <div className="text-center py-10 text-red-600 bg-red-50 rounded-lg">{error}</div>;
    
    const displayOrder: DossierStatus[] = [DossierStatus.SUBMITTED, DossierStatus.APPROVED, DossierStatus.REJECTED];

    return (
        <div>
            <Link to="/admin" className="flex items-center space-x-2 text-sky-600 hover:underline mb-6">
                <ArrowLeft size={18} />
                <span>Volver al Panel de Administración</span>
            </Link>
            
            {entity && (
                <div className="mb-8 p-4 bg-white rounded-lg shadow-sm border-l-4 border-sky-500">
                    <h1 className="text-3xl font-bold text-slate-800">{entity.entityName}</h1>
                    <p className="text-slate-500">{entity.email}</p>
                </div>
            )}

            {dossiers.length > 0 ? (
                <div>
                    {displayOrder.map(status => (
                        <DossierStatusList key={status} dossiers={dossiers} status={status} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-white rounded-lg shadow">
                    <FileText size={48} className="mx-auto text-slate-400" />
                    <h3 className="mt-4 text-xl font-semibold text-slate-700">Esta entidad no tiene dossiers</h3>
                    <p className="mt-1 text-slate-500">No se han encontrado dossiers para {entity?.entityName || 'esta entidad'}.</p>
                </div>
            )}
        </div>
    );
};

export default EntityDossiers;