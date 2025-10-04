//
// --- REGLAS DE FIRESTORE ---
//
// IMPORTANTE: Mantener siempre actualizadas estas reglas en el `console.firebase.google.com`
// para asegurar la consistencia y seguridad de la aplicación.
//

const FIRESTORE_RULES = `
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    // REGLA DEFINITIVA:
    // Permite el acceso de lectura y escritura a CUALQUIER documento
    // si, y solo si, el usuario ha iniciado sesión.
    // Esto elimina CUALQUIER posible error de permisos cruzados.
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
`;

// This file is for documentation purposes only and is not used by the application code.
// To deploy, copy the content of the FIRESTORE_RULES string into the Firebase Console.