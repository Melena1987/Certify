import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import type { Dossier, UserProfile } from '../types';
import { DossierStatus } from '../types';
import Spinner from './Spinner';
import { Link } from 'react-router-dom';
import { Building, ChevronsRight, FileText, FolderCheck, FolderClock, FolderX } from 'lucide-react';

const statusConfig = {
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
    }
};

const DossierList: React.FC<{ dossiers: Dossier[], status: DossierStatus }> = ({ dossiers, status }) => {
    const filteredDossiers = dossiers.filter(d => d.status === status);
    const config = statusConfig[status];

    if (filteredDossiers.length === 0) {
        return null;
    }

    return (
        <div>
            <div className="flex items-center space-x-3 mb-4">
                <config.icon size={24} className={config.iconClass} />
                <h2 className="text-xl font-semibold text-slate-700">{config.title} ({filteredDossiers.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDossiers.map(dossier => (
                    <div key={dossier.id} className="bg-white p-6 rounded-lg shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">{dossier.eventName}</h3>
                            <p className="text-sm text-slate-500 mt-1">{dossier.entityName}</p>
                            <p className="text-xs text-slate-400 mt-2">{new Date(dossier.eventDate).toLocaleDateString('es-ES')}</p>
                        </div>
                        <div className="border-t mt-4 pt-4">
                            <Link to={`/admin/dossier/${dossier.id}`} className="flex items-center text-sky-600 font-medium text-sm hover:underline">
                                <span>Revisar Dossier</span>
                                <ChevronsRight size={18} className="ml-1"/>
                            </Link>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const EntityList: React.FC = () => {
    const [entities, setEntities] = useState<UserProfile[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchEntities = async () => {
            try {
                // The query was likely failing silently without a composite index on (role, entityName).
                // Removing orderBy from the query and sorting client-side fixes this.
                const q = query(collection(db, "users"), where("role", "==", "ENTITY"));
                const querySnapshot = await getDocs(q);
                const entitiesData = querySnapshot.docs.map(doc => doc.data() as UserProfile);
                entitiesData.sort((a, b) => a.entityName.localeCompare(b.entityName));
                setEntities(entitiesData);
            } catch (error) {
                console.error("Error fetching entities: ", error);
            } finally {
                setLoading(false);
            }
        };
        fetchEntities();
    }, []);

    if (loading) return <div className="flex justify-center items-center mt-16"><Spinner /></div>;

    return (
         <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold text-slate-700">Entidades Registradas ({entities.length})</h2>
            </div>
            {entities.length > 0 ? (
                <ul className="divide-y divide-slate-200">
                    {entities.map(entity => (
                        <li key={entity.uid}>
                            <Link to={`/admin/entity/${entity.uid}`} className="block hover:bg-slate-50 transition-colors duration-200">
                                <div className="py-4 px-6 flex items-center justify-between">
                                    <div>
                                        <p className="font-medium text-slate-800">{entity.entityName}</p>
                                        <p className="text-sm text-slate-500">{entity.email}</p>
                                    </div>
                                    <ChevronsRight className="h-5 w-5 text-slate-400" />
                                </div>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="text-center py-10 px-6">
                    <Building size={48} className="mx-auto text-slate-400" />
                    <h3 className="mt-4 text-lg font-semibold text-slate-600">No hay entidades registradas</h3>
                    <p className="mt-1 text-slate-500 text-sm">Cuando una nueva entidad se registre, aparecerá aquí.</p>
                </div>
            )}
        </div>
    )
}


const AdminDashboard: React.FC = () => {
    const [dossiers, setDossiers] = useState<Dossier[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'dossiers' | 'entities'>('dossiers');

    useEffect(() => {
        setLoading(true);
        const q = query(
            collection(db, 'dossiers'),
            where('status', 'in', [DossierStatus.SUBMITTED, DossierStatus.APPROVED, DossierStatus.REJECTED]),
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
    }, []);

    return (
        <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Panel de Administración</h1>
            <p className="text-slate-500 mb-6">Gestiona los dossiers y entidades de la plataforma.</p>

            <div className="mb-6 border-b border-slate-200">
                <nav className="flex space-x-6">
                    <button
                        onClick={() => setActiveTab('dossiers')}
                        className={`py-3 px-1 text-sm font-medium transition-colors ${activeTab === 'dossiers' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Dossiers
                    </button>
                    <button
                        onClick={() => setActiveTab('entities')}
                        className={`py-3 px-1 text-sm font-medium transition-colors ${activeTab === 'entities' ? 'border-b-2 border-sky-600 text-sky-600' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Entidades
                    </button>
                </nav>
            </div>

            {loading ? (
                <div className="flex justify-center items-center mt-16"><Spinner /></div>
            ) : activeTab === 'dossiers' ? (
                <div className="space-y-8">
                    <DossierList dossiers={dossiers} status={DossierStatus.SUBMITTED} />
                    <DossierList dossiers={dossiers} status={DossierStatus.APPROVED} />
                    <DossierList dossiers={dossiers} status={DossierStatus.REJECTED} />
                    {dossiers.length === 0 && (
                        <div className="text-center py-16 bg-white rounded-lg shadow">
                            <FileText size={48} className="mx-auto text-slate-400" />
                            <h3 className="mt-4 text-xl font-semibold text-slate-700">No hay dossiers para revisar</h3>
                            <p className="mt-1 text-slate-500">Cuando una entidad envíe un dossier, aparecerá aquí.</p>
                        </div>
                    )}
                </div>
            ) : (
                <EntityList />
            )}
        </div>
    );
};

export default AdminDashboard;