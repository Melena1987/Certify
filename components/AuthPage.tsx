import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import Spinner from './Spinner';
import { ShieldCheck, X } from 'lucide-react';

const PolicyModal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode; }> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-slate-800">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4 text-slate-600">
            {children}
        </div>
        <div className="p-4 border-t flex justify-end">
            <button onClick={onClose} className="py-2 px-4 bg-sky-600 text-white rounded-md hover:bg-sky-700 transition">
                Cerrar
            </button>
        </div>
      </div>
    </div>
  );
};

const AuthPage: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [entityName, setEntityName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);

  const handleFirebaseError = (err: any): string => {
    switch (err.code) {
      case 'auth/email-already-in-use':
        return 'Este email ya está registrado. Por favor, inicia sesión o utiliza otro email.';
      case 'auth/invalid-email':
        return 'El formato del email no es válido. Por favor, comprueba que esté bien escrito.';
      case 'auth/weak-password':
        return 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'El email o la contraseña son incorrectos. Por favor, inténtalo de nuevo.';
      default:
        console.error("Firebase Auth Error:", err);
        return 'Ha ocurrido un error inesperado. Por favor, inténtalo más tarde.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        if (!entityName) {
            setError('El nombre de la entidad es obligatorio.');
            setLoading(false);
            return;
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        // Create a user document in Firestore
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          entityName: entityName,
          email: user.email,
          role: 'ENTITY',
        });
      }
    } catch (err: any) {
      setError(handleFirebaseError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4 relative">
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6 lg:top-8 lg:left-8">
        <img
          src="https://firebasestorage.googleapis.com/v0/b/certify-diputacion.firebasestorage.app/o/recursos%2Fmarca_mlg_compite_diputacion_monocromatico_azul.png?alt=media&token=f2295896-b2f4-44c2-a3f8-8f895e994eb8"
          alt="Logo de la Diputación de Málaga"
          className="h-12"
        />
      </div>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
            <ShieldCheck className="h-12 w-12 text-sky-600 mx-auto" />
            <h1 className="text-3xl font-bold text-slate-800 mt-2">Certify</h1>
            <p className="text-slate-500">Justificación de patrocinios</p>
        </div>
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <h2 className="text-2xl font-semibold text-center text-slate-700 mb-6">
            {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
          </h2>
          {error && <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4 text-sm">{error}</p>}
          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="mb-4">
                <label className="block text-slate-600 text-sm font-medium mb-2" htmlFor="entityName">
                  Nombre de la Entidad
                </label>
                <input
                  id="entityName"
                  type="text"
                  value={entityName}
                  onChange={(e) => setEntityName(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                  required
                />
              </div>
            )}
            <div className="mb-4">
              <label className="block text-slate-600 text-sm font-medium mb-2" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                required
              />
            </div>
            <div className="mb-6">
              <label className="block text-slate-600 text-sm font-medium mb-2" htmlFor="password">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition"
                required
              />
            </div>
            
            {!isLogin && (
                <div className="mb-6">
                    <label className="flex items-start sm:items-center space-x-3">
                        <input
                            type="checkbox"
                            checked={termsAccepted}
                            onChange={(e) => setTermsAccepted(e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 mt-1 sm:mt-0 flex-shrink-0"
                            id="terms"
                        />
                         <span className="text-sm text-slate-600">
                            He leído y acepto la{' '}
                            <button
                                type="button"
                                onClick={() => setIsPolicyModalOpen(true)}
                                className="font-medium text-sky-600 hover:underline"
                            >
                                Política de Cookies
                            </button>
                            .
                        </span>
                    </label>
                </div>
            )}

            <button
              type="submit"
              disabled={loading || (!isLogin && !termsAccepted)}
              className="w-full bg-sky-600 text-white py-2 px-4 rounded-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition flex justify-center items-center disabled:bg-slate-400 disabled:cursor-not-allowed"
            >
              {loading ? <Spinner className="h-5 w-5"/> : (isLogin ? 'Iniciar Sesión' : 'Registrarse')}
            </button>
          </form>
          <p className="text-center text-sm text-slate-500 mt-6">
            {isLogin ? '¿No tienes una cuenta?' : '¿Ya tienes una cuenta?'}
            <button onClick={() => setIsLogin(!isLogin)} className="font-medium text-sky-600 hover:text-sky-500 ml-1">
              {isLogin ? 'Regístrate' : 'Inicia Sesión'}
            </button>
          </p>
        </div>
      </div>
      <PolicyModal
            isOpen={isPolicyModalOpen}
            onClose={() => setIsPolicyModalOpen(false)}
            title="Política de Cookies de Certify"
        >
            <h3 className="font-bold text-lg text-slate-700">¿Qué son las cookies?</h3>
            <p>Las cookies son pequeños ficheros de datos que se colocan en tu ordenador o dispositivo móvil cuando visitas un sitio web. Son ampliamente utilizadas por los propietarios de sitios web para que sus sitios funcionen, o para que funcionen de manera más eficiente, así como para proporcionar información de reporte.</p>
            <h3 className="font-bold text-lg text-slate-700">¿Por qué usamos cookies?</h3>
            <p>Utilizamos cookies por varias razones. Algunas cookies son necesarias por razones técnicas para que nuestra aplicación funcione, y las llamamos cookies "esenciales" o "estrictamente necesarias".</p>
            <p><strong>Cookies Esenciales:</strong> Estas cookies son indispensable para proporcionarte los servicios disponibles a través de nuestra aplicación y para permitirte usar algunas de sus funciones, como el acceso a áreas seguras (inicio de sesión). Sin estas cookies, los servicios que has solicitado no se pueden proporcionar. Solo usamos estas cookies para ofrecerte dichos servicios.</p>
            <p><strong>Cookies de Funcionalidad:</strong> Estas cookies nos permiten recordar las elecciones que haces al usar la aplicación, como recordar tus datos de inicio de sesión. El propósito de estas cookies es proporcionarte una experiencia más personal y evitar que tengas que volver a introducir tus preferencias cada vez que usas la aplicación.</p>
            <p>En esta fase inicial del proyecto, Certify solo utiliza cookies esenciales y de funcionalidad para garantizar el correcto funcionamiento del inicio de sesión y la experiencia de usuario. No utilizamos cookies de análisis de terceros ni cookies de publicidad.</p>
            <h3 className="font-bold text-lg text-slate-700">¿Cómo puedes controlar las cookies?</h3>
            <p>Dado que solo utilizamos cookies estrictamente necesarias para el funcionamiento de la plataforma, el uso de la aplicación implica su aceptación. Sin embargo, la mayoría de los navegadores web te permiten controlar la mayoría de las cookies a través de la configuración del navegador. Para obtener más información sobre las cookies, incluido cómo ver qué cookies se han establecido, visita www.aboutcookies.org o www.allaboutcookies.org.</p>
            <h3 className="font-bold text-lg text-slate-700">Cambios en esta política</h3>
            <p>Podemos actualizar esta Política de Cookies de vez en cuando para reflejar, por ejemplo, cambios en las cookies que usamos o por otras razones operativas, legales o regulatorias. Por lo tanto, te pedimos que visites esta Política de Cookies regularmente para mantenerte informado sobre nuestro uso de cookies y tecnologías relacionadas.</p>
            <h3 className="font-bold text-lg text-slate-700">¿Dónde puedes obtener más información?</h3>
            <p>Si tienes alguna pregunta sobre nuestro uso de cookies u otras tecnologías, por favor envíanos un correo electrónico a manu@showtimeexperience.com</p>
      </PolicyModal>
    </div>
  );
};

export default AuthPage;