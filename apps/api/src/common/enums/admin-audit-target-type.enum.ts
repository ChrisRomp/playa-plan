/**
 * Represents the types of records that can be targeted by administrative actions
 * and tracked in the audit trail
 */
export enum AdminAuditTargetType {
  REGISTRATION = 'REGISTRATION',
  USER = 'USER',
  PAYMENT = 'PAYMENT',
  WORK_SHIFT = 'WORK_SHIFT',
  CAMPING_OPTION = 'CAMPING_OPTION',
} 