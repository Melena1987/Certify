//
// --- REGLAS DE STORAGE ---
//
// IMPORTANTE: Mantener siempre actualizadas estas reglas en el `console.firebase.google.com`
// para asegurar la consistencia y seguridad de la aplicación.
//

const STORAGE_RULES = `
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {

    // --- Funciones de Ayuda ---
    // Estas funciones centralizan la lógica para mejorar la legibilidad y el mantenimiento.

    // Verifica si el usuario autenticado es un administrador.
    function isAdmin() {
      // Se asume que el perfil del usuario existe. La app debería garantizar esto.
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'DIPUTACION';
    }
    
    // Verifica si el usuario es el propietario de un dossier para leerlo.
    function isDossierOwner(dossierId) {
      return get(/databases/$(database)/documents/dossiers/$(dossierId)).data.userId == request.auth.uid;
    }

    // Verifica si el usuario puede escribir (subir/borrar) archivos en un dossier.
    // Esta es la función clave que resuelve el problema de permisos.
    function canWriteToDossier(dossierId) {
      // Primero, obtenemos el recurso del dossier desde Firestore.
      let dossierResource = get(/databases/$(database)/documents/dossiers/$(dossierId));
      
      // LA CORRECCIÓN CRÍTICA:
      // Verificamos que el recurso no sea nulo ANTES de intentar acceder a su propiedad '.data'.
      // Esto maneja de forma robusta el retardo de propagación, donde el documento puede no ser
      // encontrado inmediatamente después de su creación.
      return dossierResource != null && 
             dossierResource.data.userId == request.auth.uid && 
             dossierResource.data.status == 'Borrador';
    }

    // --- Reglas para los Archivos de Dossiers ---
    // Se aplica a la ruta: dossiers/{dossierId}/{supportId}/{fileName}
    match /dossiers/{dossierId}/{supportId}/{fileName} {
      
      // LEER (Ver/Descargar):
      // Permitido si el usuario es el propietario del dossier o un admin.
      allow read: if request.auth != null && (isDossierOwner(dossierId) || isAdmin());

      // ESCRIBIR (Subir, Actualizar y Borrar):
      // Permitido únicamente si el usuario es el propietario del dossier Y el dossier está en 'Borrador'.
      allow write: if request.auth != null && canWriteToDossier(dossierId);
    }

    // --- Reglas para Recursos Públicos (logo) ---
    // Se aplica a archivos en la carpeta /recursos/
    match /recursos/{allPaths=**} {
      // Permite que cualquiera pueda leer estos archivos.
      allow read: if true;
      
      // Prohíbe la escritura desde el cliente para mayor seguridad.
      allow write: if false;
    }
  }
}
`;

// This file is for documentation purposes only and is not used by the application code.
// To deploy, copy the content of the STORAGE_RULES string into the Firebase Console.