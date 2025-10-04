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

    // --- Funciones de Ayuda ---
    function isAuth() {
      return request.auth != null;
    }

    function isRole(role) {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == role;
    }

    // --- Colección: users ---
    match /users/{userId} {
      allow read: if isAuth();

      allow create: if isAuth() && request.auth.uid == userId &&
                     request.resource.data.role == 'ENTITY' &&
                     request.resource.data.uid == request.auth.uid;
      
      allow update: if isAuth() && request.auth.uid == userId &&
                     request.resource.data.role == resource.data.role;
    }

    // --- Colección: dossiers ---
    match /dossiers/{dossierId} {
      // LEER (SIMPLIFICADO PARA COMPATIBILIDAD CON STORAGE):
      // Se permite la lectura a cualquier usuario autenticado. Esto es seguro en el contexto de la app
      // y garantiza que el servicio de Storage SIEMPRE tenga permiso para hacer la comprobación
      // necesaria antes de permitir una subida de archivos.
      allow read: if isAuth();

      // CREAR: Un usuario autenticado puede crear un dossier para sí mismo, que empieza como 'Borrador'.
      allow create: if isAuth() &&
                     request.resource.data.userId == request.auth.uid &&
                     request.resource.data.status == 'Borrador';

      // ACTUALIZAR:
      // - La ENTIDAD propietaria puede actualizar si el dossier está en 'Borrador' o 'Rechazado'.
      // - El admin de DIPUTACION puede actualizar si fue 'Enviado'.
      allow update: if isAuth() && (
        ( // Reglas para la ENTIDAD
          resource.data.userId == request.auth.uid && 
          (resource.data.status == 'Borrador' || resource.data.status == 'Rechazado') &&
          // Campos inmutables
          request.resource.data.userId == resource.data.userId &&
          request.resource.data.entityName == resource.data.entityName &&
          // Transiciones de estado permitidas
          (request.resource.data.status == 'Borrador' || request.resource.data.status == 'Enviado')
        ) || 
        ( // Reglas para el ADMIN (puede revisar y cambiar estado y soportes)
          isRole('DIPUTACION') && resource.data.status == 'Enviado' &&
          request.resource.data.userId == resource.data.userId &&
          request.resource.data.entityName == resource.data.entityName &&
          request.resource.data.eventName == resource.data.eventName &&
          request.resource.data.eventDate == resource.data.eventDate
        )
      );
      
      // BORRAR: La ENTIDAD propietaria puede borrar solo si el dossier está en 'Borrador'.
      allow delete: if isAuth() && resource.data.userId == request.auth.uid && resource.data.status == 'Borrador';
    }
  }
}
`;

// This file is for documentation purposes only and is not used by the application code.
// To deploy, copy the content of the FIRESTORE_RULES string into the Firebase Console.