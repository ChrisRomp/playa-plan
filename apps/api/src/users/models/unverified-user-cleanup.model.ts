export interface UnverifiedUserCleanupCandidate {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly createdAt: Date;
}

export interface UnverifiedUserCleanupPage {
  readonly users: UnverifiedUserCleanupCandidate[];
  readonly total: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly minimumAgeDays: number;
}

export type UnverifiedUserCleanupSkipReason =
  | 'NOT_FOUND'
  | 'PROTECTED_ROLE'
  | 'ALREADY_VERIFIED'
  | 'TOO_NEW'
  | 'ACTIVE_LOGIN'
  | 'HAS_REGISTRATIONS'
  | 'HAS_PASSKEYS'
  | 'HAS_RELATED_ACTIVITY';

export interface SkippedUnverifiedUserCleanup {
  readonly id: string;
  readonly reason: UnverifiedUserCleanupSkipReason;
}

export interface DeleteUnverifiedUsersResult {
  readonly deleted: UnverifiedUserCleanupCandidate[];
  readonly skipped: SkippedUnverifiedUserCleanup[];
}
