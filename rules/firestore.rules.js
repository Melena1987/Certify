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
                     // Un usuario no puede cambiar su propio rol.
                     request.resource.data.role == resource.data.role;
    }

    // --- Colección: dossiers ---
    match /dossiers/{dossierId} {
      // LEER (REGLA CLAVE PARA LA SOLUCIÓN):
      // Se permite la lectura a cualquier usuario autenticado.
      // Esto es crucial para que las reglas de Storage puedan verificar el estado y la propiedad del dossier.
      // La seguridad se mantiene porque las reglas de escritura (create, update, delete) siguen siendo estrictas.
      allow read: if isAuth();

      // CREAR: Un usuario autenticado puede crear un dossier para sí mismo, que empieza como 'Borrador'.
      allow create: if isAuth() &&
                     request.resource.data.userId == request.auth.uid &&
                     request.resource.data.status == 'Borrador';

      // ACTUALIZAR:
      allow update: if isAuth() && (
        ( // Reglas para la ENTIDAD: Puede editar si es suyo y está en Borrador o Rechazado.
          resource.data.userId == request.auth.uid && 
          (resource.data.status == 'Borrador' || resource.data.status == 'Rechazado') &&
          // Campos que la entidad no puede modificar.
          request.resource.data.userId == resource.data.userId &&
          request.resource.data.entityName == resource.data.entityName &&
          // Transiciones de estado permitidas para la entidad.
          (request.resource.data.status == 'Borrador' || request.resource.data.status == 'Enviado')
        ) || 
        ( // Reglas para el ADMIN (DIPUTACION): Puede revisar y cambiar el estado/soportes si fue 'Enviado'.
          isRole('DIPUTACION') && resource.data.status == 'Enviado' &&
          // Campos que el admin no debe modificar.
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