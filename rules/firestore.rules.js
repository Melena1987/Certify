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
      // Esta llamada get() funciona de forma fiable porque la regla de lectura de usuarios no es circular.
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == role;
    }

    // --- Colección: users ---
    // Reglas para los perfiles de usuario.
    match /users/{userId} {
      // LEER: Se permite leer a cualquier usuario autenticado para romper la dependencia circular
      // en la función isRole(). En el contexto de esta app, es seguro que las entidades
      // puedan ver los datos básicos (nombre, email) de otras.
      allow read: if isAuth();

      // CREAR: Un usuario puede crear su propio perfil al registrarse como 'ENTITY'.
      allow create: if isAuth() && request.auth.uid == userId &&
                     request.resource.data.role == 'ENTITY' &&
                     request.resource.data.uid == request.auth.uid;
      
      // ACTUALIZAR: Un usuario puede actualizar su perfil pero no su rol.
      allow update: if isAuth() && request.auth.uid == userId &&
                     request.resource.data.role == resource.data.role;
    }

    // --- Colección: dossiers ---
    // Reglas para los documentos de los dossiers.
    match /dossiers/{dossierId} {
      // LEER (CORREGIDO Y MÁS SEGURO):
      // Se permite la lectura EXCLUSIVAMENTE al propietario del dossier o a un administrador.
      // Esta regla explícita es la que permite que las reglas de Storage hagan la llamada get()
      // de forma segura y autorizada.
      allow read: if isAuth() && (resource.data.userId == request.auth.uid || isRole('DIPUTACION'));

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
        ( // Reglas para el ADMIN
          isRole('DIPUTACION') && resource.data.status == 'Enviado' &&
           // El Admin puede cambiar el estado y los soportes, pero no otros campos.
          request.resource.data.userId == resource.data.userId &&
          request.resource.data.entityName == resource.data.entityName &&
          request.resource.data.eventName == resource.data.eventName &&
          request.resource.data.eventDate == resource.data.eventDate
        )
      );
      
      // BORRAR:
      // - La ENTIDAD propietaria puede borrar solo si el dossier está en 'Borrador'.
      allow delete: if isAuth() && resource.data.userId == request.auth.uid && resource.data.status == 'Borrador';
    }
  }
}
`;

// This file is for documentation purposes only and is not used by the application code.
// To deploy, copy the content of the FIRESTORE_RULES string into the Firebase Console.