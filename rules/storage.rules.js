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

    // --- Reglas para los Archivos de Dossiers ---
    // Se aplica a la ruta: dossiers/{dossierId}/{supportId}/{fileName}
    match /dossiers/{dossierId}/{supportId}/{fileName} {
      
      // LEER (Ver/Descargar):
      // Permitido si el usuario es el propietario del dossier o un admin de DIPUTACION.
      // Se consulta Firestore para verificarlo.
      allow read: if request.auth != null && (
        get(/databases/$(database)/documents/dossiers/$(dossierId)).data.userId == request.auth.uid ||
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'DIPUTACION'
      );

      // ESCRIBIR (Subir y Borrar):
      // Permitido si el usuario es la ENTIDAD propietaria del dossier Y el dossier está en 'Borrador'.
      // Los administradores no pueden subir ni borrar archivos, solo cambiar el estado del soporte.
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/dossiers/$(dossierId)).data.userId == request.auth.uid &&
        get(/databases/$(database)/documents/dossiers/$(dossierId)).data.status == 'Borrador';
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
