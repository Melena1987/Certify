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
      // Devuelve true si el rol del usuario actual es 'DIPUTACION'
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'DIPUTACION';
    }

    // --- Reglas para los Archivos de Dossiers ---
    // Path: dossiers/{dossierId}/{supportId}/{fileName}
    match /dossiers/{dossierId}/{allPaths=**} {
      
      // LEER (Ver/Descargar): Permitido si el usuario es el propietario del dossier o un admin.
      allow read: if request.auth != null && (get(/databases/$(database)/documents/dossiers/$(dossierId)).data.userId == request.auth.uid || isAdmin());

      // ESCRIBIR (Subir/Actualizar/Borrar): REGLA CORREGIDA Y MÁS ROBUSTA
      // Se permite únicamente si se cumplen TODAS estas condiciones:
      // 1. El usuario está autenticado.
      // 2. El documento del dossier existe en Firestore.
      // 3. El 'userId' del dossier coincide con el del usuario.
      // 4. El 'status' del dossier es 'Borrador'.
      allow write: if request.auth != null &&
                      exists(/databases/$(database)/documents/dossiers/$(dossierId)) &&
                      get(/databases/$(database)/documents/dossiers/$(dossierId)).data.userId == request.auth.uid &&
                      get(/databases/$(database)/documents/dossiers/$(dossierId)).data.status == 'Borrador';
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