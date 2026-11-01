import { basicSecurity, bearerSecurity } from './openapi';

// ============================================================================
// Preset route per modul: method + tags + security.
// Dipakai dengan spread di createRoute: createRoute({ ...GET_DOCUMENT_METHOD, path: ..., ... })
// ============================================================================

// ----------------------------------------------------------------------------
// Documents
// ----------------------------------------------------------------------------
export const GET_DOCUMENT_METHOD = {
  method: 'get' as const,
  tags: ['Documents'],
  security: bearerSecurity,
};

export const POST_DOCUMENT_METHOD = {
  method: 'post' as const,
  tags: ['Documents'],
  security: bearerSecurity,
};

export const DELETE_DOCUMENT_METHOD = {
  method: 'delete' as const,
  tags: ['Documents'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Admin (Basic Auth)
// ----------------------------------------------------------------------------
export const GET_ADMIN_METHOD = {
  method: 'get' as const,
  tags: ['Admin'],
  security: basicSecurity,
};

// ----------------------------------------------------------------------------
// Navigation
// ----------------------------------------------------------------------------
export const GET_NAVIGATION_METHOD = {
  method: 'get' as const,
  tags: ['Navigation'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// System / Backup
// ----------------------------------------------------------------------------
export const GET_SYSTEM_METHOD = {
  method: 'get' as const,
  tags: ['System'],
  security: bearerSecurity,
};

export const POST_SYSTEM_METHOD = {
  method: 'post' as const,
  tags: ['System'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Master Data
// ----------------------------------------------------------------------------
export const GET_MASTER_METHOD = {
  method: 'get' as const,
  tags: ['Master'],
  security: bearerSecurity,
};

export const POST_MASTER_METHOD = {
  method: 'post' as const,
  tags: ['Master'],
  security: bearerSecurity,
};

export const PATCH_MASTER_METHOD = {
  method: 'patch' as const,
  tags: ['Master'],
  security: bearerSecurity,
};

export const DELETE_MASTER_METHOD = {
  method: 'delete' as const,
  tags: ['Master'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------
export const GET_SETTING_METHOD = {
  method: 'get' as const,
  tags: ['Settings'],
  security: bearerSecurity,
};

export const PUT_SETTING_METHOD = {
  method: 'put' as const,
  tags: ['Settings'],
  security: bearerSecurity,
};

export const DELETE_SETTING_METHOD = {
  method: 'delete' as const,
  tags: ['Settings'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Agenda
// ----------------------------------------------------------------------------
export const GET_AGENDA_METHOD = {
  method: 'get' as const,
  tags: ['Agenda'],
  security: bearerSecurity,
};

export const POST_AGENDA_METHOD = {
  method: 'post' as const,
  tags: ['Agenda'],
  security: bearerSecurity,
};

export const PATCH_AGENDA_METHOD = {
  method: 'patch' as const,
  tags: ['Agenda'],
  security: bearerSecurity,
};

export const DELETE_AGENDA_METHOD = {
  method: 'delete' as const,
  tags: ['Agenda'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Alibi
// ----------------------------------------------------------------------------
export const GET_ALIBI_METHOD = {
  method: 'get' as const,
  tags: ['Alibi'],
  security: bearerSecurity,
};

export const POST_ALIBI_METHOD = {
  method: 'post' as const,
  tags: ['Alibi'],
  security: bearerSecurity,
};

export const PATCH_ALIBI_METHOD = {
  method: 'patch' as const,
  tags: ['Alibi'],
  security: bearerSecurity,
};

export const DELETE_ALIBI_METHOD = {
  method: 'delete' as const,
  tags: ['Alibi'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// User
// ----------------------------------------------------------------------------
export const POST_USER_PUBLIC_METHOD = {
  method: 'post' as const,
  tags: ['User'],
};

export const GET_USER_METHOD = {
  method: 'get' as const,
  tags: ['User'],
  security: bearerSecurity,
};

export const POST_USER_METHOD = {
  method: 'post' as const,
  tags: ['User'],
  security: bearerSecurity,
};

export const PATCH_USER_METHOD = {
  method: 'patch' as const,
  tags: ['User'],
  security: bearerSecurity,
};

export const GET_USER_ADMIN_METHOD = {
  method: 'get' as const,
  tags: ['User Admin'],
  security: bearerSecurity,
};

export const POST_USER_ADMIN_METHOD = {
  method: 'post' as const,
  tags: ['User Admin'],
  security: bearerSecurity,
};

export const PATCH_USER_ADMIN_METHOD = {
  method: 'patch' as const,
  tags: ['User Admin'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Assignment Letters
// ----------------------------------------------------------------------------
export const GET_ASSIGNMENT_LETTER_METHOD = {
  method: 'get' as const,
  tags: ['Assignment Letters'],
  security: bearerSecurity,
};

export const POST_ASSIGNMENT_LETTER_METHOD = {
  method: 'post' as const,
  tags: ['Assignment Letters'],
  security: bearerSecurity,
};

export const PATCH_ASSIGNMENT_LETTER_METHOD = {
  method: 'patch' as const,
  tags: ['Assignment Letters'],
  security: bearerSecurity,
};

export const DELETE_ASSIGNMENT_LETTER_METHOD = {
  method: 'delete' as const,
  tags: ['Assignment Letters'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Assignment Members
// ----------------------------------------------------------------------------
export const POST_ASSIGNMENT_MEMBER_METHOD = {
  method: 'post' as const,
  tags: ['Assignment Members'],
  security: bearerSecurity,
};

export const PATCH_ASSIGNMENT_MEMBER_METHOD = {
  method: 'patch' as const,
  tags: ['Assignment Members'],
  security: bearerSecurity,
};

export const DELETE_ASSIGNMENT_MEMBER_METHOD = {
  method: 'delete' as const,
  tags: ['Assignment Members'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Assignment Notes
// ----------------------------------------------------------------------------
export const POST_ASSIGNMENT_NOTE_METHOD = {
  method: 'post' as const,
  tags: ['Assignment Notes'],
  security: bearerSecurity,
};

export const PATCH_ASSIGNMENT_NOTE_METHOD = {
  method: 'patch' as const,
  tags: ['Assignment Notes'],
  security: bearerSecurity,
};

export const DELETE_ASSIGNMENT_NOTE_METHOD = {
  method: 'delete' as const,
  tags: ['Assignment Notes'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Assignment Copies
// ----------------------------------------------------------------------------
export const POST_ASSIGNMENT_COPY_METHOD = {
  method: 'post' as const,
  tags: ['Assignment Copies'],
  security: bearerSecurity,
};

export const PATCH_ASSIGNMENT_COPY_METHOD = {
  method: 'patch' as const,
  tags: ['Assignment Copies'],
  security: bearerSecurity,
};

export const DELETE_ASSIGNMENT_COPY_METHOD = {
  method: 'delete' as const,
  tags: ['Assignment Copies'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Dispositions
// ----------------------------------------------------------------------------
export const GET_DISPOSITION_METHOD = {
  method: 'get' as const,
  tags: ['Dispositions'],
  security: bearerSecurity,
};

export const POST_DISPOSITION_METHOD = {
  method: 'post' as const,
  tags: ['Dispositions'],
  security: bearerSecurity,
};

export const PATCH_DISPOSITION_METHOD = {
  method: 'patch' as const,
  tags: ['Dispositions'],
  security: bearerSecurity,
};

export const DELETE_DISPOSITION_METHOD = {
  method: 'delete' as const,
  tags: ['Dispositions'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Service Requests
// ----------------------------------------------------------------------------
export const GET_SERVICE_REQUEST_METHOD = {
  method: 'get' as const,
  tags: ['Service Requests'],
  security: bearerSecurity,
};

export const POST_SERVICE_REQUEST_METHOD = {
  method: 'post' as const,
  tags: ['Service Requests'],
  security: bearerSecurity,
};

export const PATCH_SERVICE_REQUEST_METHOD = {
  method: 'patch' as const,
  tags: ['Service Requests'],
  security: bearerSecurity,
};

export const DELETE_SERVICE_REQUEST_METHOD = {
  method: 'delete' as const,
  tags: ['Service Requests'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Leave
// ----------------------------------------------------------------------------
export const GET_LEAVE_METHOD = {
  method: 'get' as const,
  tags: ['Leave'],
  security: bearerSecurity,
};

export const POST_LEAVE_METHOD = {
  method: 'post' as const,
  tags: ['Leave'],
  security: bearerSecurity,
};

export const PATCH_LEAVE_METHOD = {
  method: 'patch' as const,
  tags: ['Leave'],
  security: bearerSecurity,
};

export const DELETE_LEAVE_METHOD = {
  method: 'delete' as const,
  tags: ['Leave'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Leave Quota
// ----------------------------------------------------------------------------
export const GET_LEAVE_QUOTA_METHOD = {
  method: 'get' as const,
  tags: ['Leave Quota'],
  security: bearerSecurity,
};

export const POST_LEAVE_QUOTA_METHOD = {
  method: 'post' as const,
  tags: ['Leave Quota'],
  security: bearerSecurity,
};

export const PUT_LEAVE_QUOTA_METHOD = {
  method: 'put' as const,
  tags: ['Leave Quota'],
  security: bearerSecurity,
};

export const DELETE_LEAVE_QUOTA_METHOD = {
  method: 'delete' as const,
  tags: ['Leave Quota'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Leave Letters
// ----------------------------------------------------------------------------
export const GET_LEAVE_LETTER_METHOD = {
  method: 'get' as const,
  tags: ['Leave Letters'],
  security: bearerSecurity,
};

export const POST_LEAVE_LETTER_METHOD = {
  method: 'post' as const,
  tags: ['Leave Letters'],
  security: bearerSecurity,
};

export const DELETE_LEAVE_LETTER_METHOD = {
  method: 'delete' as const,
  tags: ['Leave Letters'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Leave Approval
// ----------------------------------------------------------------------------
export const POST_LEAVE_APPROVAL_METHOD = {
  method: 'post' as const,
  tags: ['Leave Approval'],
  security: bearerSecurity,
};

// ----------------------------------------------------------------------------
// Leave Admin
// ----------------------------------------------------------------------------
export const GET_LEAVE_ADMIN_METHOD = {
  method: 'get' as const,
  tags: ['Leave Admin'],
  security: bearerSecurity,
};

export const POST_LEAVE_ADMIN_METHOD = {
  method: 'post' as const,
  tags: ['Leave Admin'],
  security: bearerSecurity,
};

export const PATCH_LEAVE_ADMIN_METHOD = {
  method: 'patch' as const,
  tags: ['Leave Admin'],
  security: bearerSecurity,
};

export const PUT_LEAVE_ADMIN_METHOD = {
  method: 'put' as const,
  tags: ['Leave Admin'],
  security: bearerSecurity,
};

export const DELETE_LEAVE_ADMIN_METHOD = {
  method: 'delete' as const,
  tags: ['Leave Admin'],
  security: bearerSecurity,
};

