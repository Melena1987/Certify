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
    // REGLA DEFINITIVA:
    // Permite la lectura y escritura de CUALQUIER archivo
    // si, y solo si, el usuario ha iniciado sesión.
    // No más errores 403.
    match /{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
`;

// This file is for documentation purposes only and is not used by the application code.
// To deploy, copy the content of the STORAGE_RULES string into the Firebase Console.