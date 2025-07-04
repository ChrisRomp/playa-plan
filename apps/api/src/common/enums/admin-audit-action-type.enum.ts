/**
 * Represents the types of actions that can be performed by administrators
 * and tracked in the audit trail
 */
export enum AdminAuditActionType {
  REGISTRATION_EDIT = 'REGISTRATION_EDIT',
  REGISTRATION_CANCEL = 'REGISTRATION_CANCEL',
  PAYMENT_REFUND = 'PAYMENT_REFUND',
  WORK_SHIFT_ADD = 'WORK_SHIFT_ADD',
  WORK_SHIFT_REMOVE = 'WORK_SHIFT_REMOVE',
  WORK_SHIFT_MODIFY = 'WORK_SHIFT_MODIFY',
  CAMPING_OPTION_ADD = 'CAMPING_OPTION_ADD',
  CAMPING_OPTION_REMOVE = 'CAMPING_OPTION_REMOVE',
  CAMPING_OPTION_MODIFY = 'CAMPING_OPTION_MODIFY',
} 