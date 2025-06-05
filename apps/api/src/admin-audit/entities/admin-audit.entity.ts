import { ApiProperty } from '@nestjs/swagger';
import { AdminAuditActionType, AdminAuditTargetType, Prisma } from '@prisma/client';

/**
 * Entity representing an admin audit record in the system
 * Maps to the AdminAudit model in Prisma
 */
export class AdminAudit {
  @ApiProperty({ description: 'Unique identifier for the audit record' })
  id: string = '';

  @ApiProperty({ description: 'ID of the admin user who performed the action' })
  adminUserId: string = '';

  @ApiProperty({ 
    enum: AdminAuditActionType, 
    description: 'Type of action performed',
    example: AdminAuditActionType.REGISTRATION_EDIT,
  })
  actionType: AdminAuditActionType = AdminAuditActionType.REGISTRATION_EDIT;

  @ApiProperty({ 
    enum: AdminAuditTargetType, 
    description: 'Type of record that was targeted',
    example: AdminAuditTargetType.REGISTRATION,
  })
  targetRecordType: AdminAuditTargetType = AdminAuditTargetType.REGISTRATION;

  @ApiProperty({ description: 'ID of the record that was targeted' })
  targetRecordId: string = '';

  @ApiProperty({ 
    description: 'Previous values before the change (JSON)', 
    required: false,
    example: { status: 'PENDING', campingOption: 'RV' },
  })
  oldValues?: Prisma.JsonValue | null;

  @ApiProperty({ 
    description: 'New values after the change (JSON)', 
    required: false,
    example: { status: 'CONFIRMED', campingOption: 'Tent' },
  })
  newValues?: Prisma.JsonValue | null;

  @ApiProperty({ 
    description: 'Reason for the administrative action', 
    required: false,
    example: 'User requested change due to vehicle breakdown',
  })
  reason?: string | null;

  @ApiProperty({ 
    description: 'Transaction ID to group related audit records', 
    required: false,
  })
  transactionId?: string | null;

  @ApiProperty({ description: 'When the audit record was created' })
  createdAt: Date = new Date();

  constructor(partial: Partial<AdminAudit>) {
    Object.assign(this, partial);
  }

  /**
   * Returns a human-readable description of the action
   */
  getActionDescription(): string {
    const actionMap: Record<AdminAuditActionType, string> = {
      [AdminAuditActionType.REGISTRATION_EDIT]: 'edited registration',
      [AdminAuditActionType.REGISTRATION_CANCEL]: 'cancelled registration',
      [AdminAuditActionType.PAYMENT_REFUND]: 'processed refund',
      [AdminAuditActionType.WORK_SHIFT_ADD]: 'added work shift',
      [AdminAuditActionType.WORK_SHIFT_REMOVE]: 'removed work shift',
      [AdminAuditActionType.WORK_SHIFT_MODIFY]: 'modified work shift',
      [AdminAuditActionType.CAMPING_OPTION_ADD]: 'added camping option',
      [AdminAuditActionType.CAMPING_OPTION_REMOVE]: 'removed camping option',
      [AdminAuditActionType.CAMPING_OPTION_MODIFY]: 'modified camping option',
    };

    return actionMap[this.actionType] || 'performed unknown action';
  }

  /**
   * Returns a human-readable description of the target type
   */
  getTargetDescription(): string {
    const targetMap: Record<AdminAuditTargetType, string> = {
      [AdminAuditTargetType.REGISTRATION]: 'registration',
      [AdminAuditTargetType.USER]: 'user',
      [AdminAuditTargetType.PAYMENT]: 'payment',
      [AdminAuditTargetType.WORK_SHIFT]: 'work shift',
      [AdminAuditTargetType.CAMPING_OPTION]: 'camping option',
    };

    return targetMap[this.targetRecordType] || 'unknown record';
  }

  /**
   * Returns a complete human-readable description of the audit record
   */
  getFullDescription(): string {
    return `${this.getActionDescription()} for ${this.getTargetDescription()} ${this.targetRecordId}`;
  }

  /**
   * Checks if this audit record has old values
   */
  hasOldValues(): boolean {
    return this.oldValues !== null && this.oldValues !== undefined;
  }

  /**
   * Checks if this audit record has new values
   */
  hasNewValues(): boolean {
    return this.newValues !== null && this.newValues !== undefined;
  }

  /**
   * Checks if this audit record is part of a transaction
   */
  isPartOfTransaction(): boolean {
    return this.transactionId !== null && this.transactionId !== undefined;
  }
} 