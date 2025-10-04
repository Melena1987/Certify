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

    // --- Colección: users ---
    // Reglas para los perfiles de usuario.
    match /users/{userId} {
      // LEER: Un usuario puede leer su propio perfil, o un admin de DIPUTACION puede leer cualquiera.
      allow read: if request.auth.uid == userId || 
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'DIPUTACION';

      // CREAR: Un usuario puede crear su propio perfil al registrarse como 'ENTITY'.
      allow create: if request.auth.uid == userId &&
                     request.resource.data.role == 'ENTITY' &&
                     request.resource.data.uid == request.auth.uid;
      
      // ACTUALIZAR: Un usuario puede actualizar su perfil pero no su rol.
      allow update: if request.auth.uid == userId &&
                     request.resource.data.role == resource.data.role;
    }

    // --- Colección: dossiers ---
    // Reglas para los documentos de los dossiers.
    match /dossiers/{dossierId} {
      // LEER: El propietario o un admin de DIPUTACION pueden leer.
      allow read: if resource.data.userId == request.auth.uid ||
                   get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'DIPUTACION';

      // CREAR: Un usuario autenticado puede crear un dossier para sí mismo, que empieza como 'Borrador'.
      allow create: if request.auth.uid != null &&
                     request.resource.data.userId == request.auth.uid &&
                     request.resource.data.status == 'Borrador';

      // ACTUALIZAR:
      // - La ENTIDAD propietaria puede actualizar solo si el dossier está en 'Borrador'.
      // - El admin de DIPUTACION puede actualizar solo si fue 'Enviado' (para su revisión).
      allow update: if (resource.data.userId == request.auth.uid && resource.data.status == 'Borrador') ||
                     (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'DIPUTACION' && resource.data.status == 'Enviado');
      
      // BORRAR:
      // - La ENTIDAD propietaria puede borrar solo si el dossier está en 'Borrador'.
      allow delete: if resource.data.userId == request.auth.uid && resource.data.status == 'Borrador';
    }
  }
}
`;

// This file is for documentation purposes only and is not used by the application code.
// To deploy, copy the content of the FIRESTORE_RULES string into the Firebase Console.
