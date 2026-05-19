import { instanceToPlain } from 'class-transformer';
import { User } from './user.entity';
import { UserRole } from '@prisma/client';

describe('User Entity', () => {
  describe('serialization', () => {
    const userWithSecrets = {
      id: 'test-uuid',
      email: 'test@example.playaplan.app',
      firstName: 'Test',
      lastName: 'User',
      playaName: null,
      profilePicture: null,
      role: UserRole.PARTICIPANT,
      isEmailVerified: false,
      password: 'hashed_password_123',
      verificationToken: 'verify-token-abc',
      resetToken: 'reset-token-xyz',
      resetTokenExpiry: new Date('2026-01-01'),
      loginCode: '123456',
      loginCodeExpiry: new Date('2026-01-01T01:00:00Z'),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should exclude password from serialized output', () => {
      const user = new User(userWithSecrets);
      const plain = instanceToPlain(user);

      expect(plain).not.toHaveProperty('password');
    });

    it('should exclude verificationToken from serialized output', () => {
      const user = new User(userWithSecrets);
      const plain = instanceToPlain(user);

      expect(plain).not.toHaveProperty('verificationToken');
    });

    it('should exclude resetToken from serialized output', () => {
      const user = new User(userWithSecrets);
      const plain = instanceToPlain(user);

      expect(plain).not.toHaveProperty('resetToken');
    });

    it('should exclude resetTokenExpiry from serialized output', () => {
      const user = new User(userWithSecrets);
      const plain = instanceToPlain(user);

      expect(plain).not.toHaveProperty('resetTokenExpiry');
    });

    it('should exclude loginCode from serialized output', () => {
      const user = new User(userWithSecrets);
      const plain = instanceToPlain(user);

      expect(plain).not.toHaveProperty('loginCode');
    });

    it('should exclude loginCodeExpiry from serialized output', () => {
      const user = new User(userWithSecrets);
      const plain = instanceToPlain(user);

      expect(plain).not.toHaveProperty('loginCodeExpiry');
    });

    it('should include non-sensitive fields in serialized output', () => {
      const user = new User(userWithSecrets);
      const plain = instanceToPlain(user);

      expect(plain).toHaveProperty('id', 'test-uuid');
      expect(plain).toHaveProperty('email', 'test@example.playaplan.app');
      expect(plain).toHaveProperty('firstName', 'Test');
      expect(plain).toHaveProperty('lastName', 'User');
      expect(plain).toHaveProperty('role', UserRole.PARTICIPANT);
      expect(plain).toHaveProperty('isEmailVerified', false);
    });
  });
});
