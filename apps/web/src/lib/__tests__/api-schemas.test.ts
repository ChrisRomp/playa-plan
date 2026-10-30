import { describe, expect, it } from 'vitest';
import {
  CampingOptionSchema,
  JobCategorySchema,
  JobSchema,
  UserSchema as ApiUserSchema,
} from '../api';
import { PasskeySchema } from '../api/passkeys';
import {
  CreateUserSchema,
  UpdateUserSchema,
  UserSchema,
} from '../../types/users';

describe('API schema compatibility', () => {
  const inputUser = {
    id: 'user-1',
    email: 'participant@example.com',
    firstName: 'Test',
    lastName: 'Participant',
    role: 'PARTICIPANT',
    isEmailVerified: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    phone: null,
    allowNoJob: false,
  };

  it('should preserve nullable profile fields and strip unknown properties', () => {
    const inputResponse = { ...inputUser, serverOnly: 'not exposed' };

    expect(ApiUserSchema.parse(inputResponse)).toEqual(inputUser);
    expect(UserSchema.parse(inputResponse)).toEqual(inputUser);
  });

  it.each([
    { email: 'invalid-email' },
    { role: 'UNKNOWN' },
    { isEmailVerified: 'true' },
  ])('should reject invalid user fields %j', (inputFields) => {
    const inputResponse = { ...inputUser, ...inputFields };

    expect(ApiUserSchema.safeParse(inputResponse).success).toBe(false);
    expect(UserSchema.safeParse(inputResponse).success).toBe(false);
  });

  it('should retain user creation validation and partial update support', () => {
    const inputCreate = {
      email: inputUser.email,
      password: 'valid-password',
      firstName: inputUser.firstName,
      lastName: inputUser.lastName,
    };

    expect(CreateUserSchema.parse(inputCreate)).toEqual(inputCreate);
    expect(CreateUserSchema.safeParse({ ...inputCreate, password: 'short' }).success).toBe(false);
    expect(UpdateUserSchema.parse({ allowRegistration: false })).toEqual({ allowRegistration: false });
    expect(UpdateUserSchema.parse({})).toEqual({});
  });

  it('should default missing job category flags without replacing explicit values', () => {
    const inputCategory = { id: 'category-1', name: 'Kitchen', description: 'Kitchen shifts' };

    expect(JobCategorySchema.parse(inputCategory)).toEqual({
      ...inputCategory,
      staffOnly: false,
      alwaysRequired: false,
    });
    expect(JobCategorySchema.parse({ ...inputCategory, staffOnly: true }).staffOnly).toBe(true);
  });

  it('should parse nested job shifts and default active jobs', () => {
    const inputShift = {
      id: 'shift-1',
      name: 'Breakfast',
      description: 'Morning shift',
      startTime: '2026-01-01T07:00:00.000Z',
      endTime: '2026-01-01T09:00:00.000Z',
      dayOfWeek: 'MONDAY',
    };
    const inputJob = {
      id: 'job-1',
      name: 'Cook',
      location: 'Kitchen',
      categoryId: 'category-1',
      shiftId: inputShift.id,
      shift: inputShift,
      maxRegistrations: 2,
    };

    expect(JobSchema.parse(inputJob)).toEqual({ ...inputJob, active: true });
    expect(JobSchema.parse({ ...inputJob, active: false }).active).toBe(false);
  });

  it('should default missing camping option category IDs', () => {
    const inputOption = {
      id: 'option-1',
      name: 'Tent',
      enabled: true,
      workShiftsRequired: 2,
      participantDues: 100,
      staffDues: 50,
      maxSignups: 10,
      createdAt: inputUser.createdAt,
      updatedAt: inputUser.updatedAt,
    };

    expect(CampingOptionSchema.parse(inputOption)).toEqual({ ...inputOption, jobCategoryIds: [] });
  });

  it('should coerce passkey dates and retain nullable last-used dates', () => {
    const inputPasskey = {
      id: 'passkey-1',
      nickname: 'Security key',
      backedUp: false,
      deviceType: null,
      lastUsedAt: null,
      createdAt: inputUser.createdAt,
    };

    expect(PasskeySchema.parse(inputPasskey)).toEqual({
      ...inputPasskey,
      transports: [],
      createdAt: new Date(inputUser.createdAt),
    });
    expect(PasskeySchema.safeParse({ ...inputPasskey, createdAt: 'invalid-date' }).success).toBe(false);
  });
});
