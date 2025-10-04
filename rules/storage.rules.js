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
    function isAdmin() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'DIPUTACION';
    }
    
    function isDossierOwner(dossierId) {
      return get(/databases/$(database)/documents/dossiers/$(dossierId)).data.userId == request.auth.uid;
    }

    function canWriteToDossier(dossierId) {
      // Verifica que el dossier exista, que el usuario sea el propietario, y que el estado sea 'Borrador'.
      return exists(/databases/$(database)/documents/dossiers/$(dossierId)) &&
             get(/databases/$(database)/documents/dossiers/$(dossierId)).data.userId == request.auth.uid &&
             get(/databases/$(database)/documents/dossiers/$(dossierId)).data.status == 'Borrador';
    }

    // --- Reglas para los Archivos de Dossiers ---
    // Path: dossiers/{dossierId}/{supportId}/{fileName}
    match /dossiers/{dossierId}/{allPaths=**} {
      
      // LEER (Ver/Descargar): Permitido al propietario del dossier o a un admin.
      allow read: if request.auth != null && (isDossierOwner(dossierId) || isAdmin());

      // ESCRIBIR (Subir/Borrar): Permitido solo si la función canWriteToDossier devuelve true.
      allow write: if request.auth != null && canWriteToDossier(dossierId);
    }

    // --- Reglas para Recursos Públicos (logo) ---
    match /recursos/{allPaths=**} {
      allow read: if true;
      allow write: if false; // Nadie puede escribir desde el cliente.
    }
  }
}
`;

// This file is for documentation purposes only and is not used by the application code.
// To deploy, copy the content of the STORAGE_RULES string into the Firebase Console.