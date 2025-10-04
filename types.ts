import { User as FirebaseUser } from 'firebase/auth';

export interface UserProfile {
  uid: string;
  email: string | null;
  entityName: string;
  role: 'ENTITY' | 'DIPUTACION';
}

// FIX: Changed AppUser from an interface extending a class to a type.
// This allows creating AppUser-compatible objects from literals/spreads
// while maintaining type safety for properties from FirebaseUser.
export type AppUser = Pick<FirebaseUser, 'uid' | 'email'> & {
  profile?: UserProfile;
};

export enum DossierStatus {
  DRAFT = 'Borrador',
  SUBMITTED = 'Enviado',
  APPROVED = 'Aprobado',
  REJECTED = 'Rechazado'
}

export enum EvidenceType {
  URL = 'url',
  IMAGE = 'image'
}

export enum SupportStatus {
  PENDING = 'Pendiente',
  APPROVED = 'Aprobado',
  REJECTED = 'Rechazado'
}


export interface Evidence {
  id: string;
  type: EvidenceType;
  value: string; // URL string or image download URL
  fileName?: string; // Optional: for displaying image file names
}

export interface Support {
  id: string;
  type: string; // From SUPPORT_TYPES constant
  evidences: Evidence[];
  status: SupportStatus;
  rejectionReason?: string;
}

export interface Dossier {
  id: string;
  userId: string;
  entityName: string;
  eventName: string;
  eventDate: string;
  status: DossierStatus;
  supports: Support[];
  createdAt: any; // Firestore Timestamp
}