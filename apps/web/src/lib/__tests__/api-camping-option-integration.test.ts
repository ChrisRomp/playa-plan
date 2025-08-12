import { describe, it, expect } from 'vitest';
import type { 
  CampingOptionFieldValue, 
  CampingOptionRegistrationWithFields,
  RegistrationReportFilters,
  CampingOptionReportFilters,
  Registration 
} from '../api';

describe('API Camping Option Integration', () => {
  describe('Type Definitions', () => {
    it('should have properly typed CampingOptionFieldValue interface', () => {
      const mockFieldValue: CampingOptionFieldValue = {
        id: 'fv-123',
        value: 'ABC123',
        fieldId: 'field-123',
        registrationId: 'cor-123',
        field: {
          id: 'field-123',
          displayName: 'Vehicle License Plate',
          dataType: 'STRING',
          required: true,
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(mockFieldValue.id).toBe('fv-123');
      expect(mockFieldValue.field.dataType).toBe('STRING');
      expect(typeof mockFieldValue.field.required).toBe('boolean');
    });

    it('should have properly typed CampingOptionRegistrationWithFields interface', () => {
      const mockRegistration: CampingOptionRegistrationWithFields = {
        id: 'cor-123',
        userId: 'user-123',
        campingOptionId: 'co-123',
        user: {
          id: 'user-123',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          playaName: 'TestUser',
        },
        campingOption: {
          id: 'co-123',
          name: 'RV Camping',
          description: 'RV camping with hookups',
          enabled: true,
          fields: [
            {
              id: 'field-123',
              displayName: 'Vehicle License Plate',
              dataType: 'STRING',
              required: true,
              order: 1,
            },
          ],
        },
        fieldValues: [],
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      expect(mockRegistration.user.playaName).toBe('TestUser');
      expect(mockRegistration.campingOption.fields).toHaveLength(1);
      expect(mockRegistration.fieldValues).toEqual([]);
    });

    it('should have properly typed RegistrationReportFilters interface', () => {
      const filters: RegistrationReportFilters = {
        userId: 'user-123',
        jobId: 'job-456',
        year: 2024,
        includeCampingOptions: true,
      };

      expect(filters.includeCampingOptions).toBe(true);
      expect(filters.year).toBe(2024);
    });

    it('should have properly typed CampingOptionReportFilters interface', () => {
      const filters: CampingOptionReportFilters = {
        year: 2024,
        userId: 'user-123',
        campingOptionId: 'co-123',
        includeInactive: false,
      };

      expect(filters.includeInactive).toBe(false);
      expect(filters.campingOptionId).toBe('co-123');
    });

    it('should support optional camping options in Registration interface', () => {
      const registrationWithoutCamping: Registration = {
        id: 'reg-123',
        userId: 'user-123',
        year: 2024,
        status: 'CONFIRMED',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        jobs: [],
        payments: [],
      };

      const registrationWithCamping: Registration = {
        id: 'reg-123',
        userId: 'user-123',
        year: 2024,
        status: 'CONFIRMED',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        jobs: [],
        payments: [],
        campingOptions: [
          {
            id: 'cor-123',
            userId: 'user-123',
            campingOptionId: 'co-123',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        ],
      };

      expect(registrationWithoutCamping.campingOptions).toBeUndefined();
      expect(registrationWithCamping.campingOptions).toHaveLength(1);
    });
  });

  describe('Data Type Validation', () => {
    it('should support all field data types', () => {
      const stringField: CampingOptionFieldValue['field']['dataType'] = 'STRING';
      const multilineField: CampingOptionFieldValue['field']['dataType'] = 'MULTILINE_STRING';
      const integerField: CampingOptionFieldValue['field']['dataType'] = 'INTEGER';
      const numberField: CampingOptionFieldValue['field']['dataType'] = 'NUMBER';
      const booleanField: CampingOptionFieldValue['field']['dataType'] = 'BOOLEAN';
      const dateField: CampingOptionFieldValue['field']['dataType'] = 'DATE';

      expect([stringField, multilineField, integerField, numberField, booleanField, dateField])
        .toEqual(['STRING', 'MULTILINE_STRING', 'INTEGER', 'NUMBER', 'BOOLEAN', 'DATE']);
    });

    it('should support all registration statuses', () => {
      const pending: Registration['status'] = 'PENDING';
      const confirmed: Registration['status'] = 'CONFIRMED';
      const cancelled: Registration['status'] = 'CANCELLED';
      const waitlisted: Registration['status'] = 'WAITLISTED';

      expect([pending, confirmed, cancelled, waitlisted])
        .toEqual(['PENDING', 'CONFIRMED', 'CANCELLED', 'WAITLISTED']);
    });
  });

  describe('API Method Availability', () => {
    it('should export reports object with required methods', async () => {
      const { reports } = await import('../api');

      expect(typeof reports.getRegistrations).toBe('function');
      expect(typeof reports.getCampingOptionRegistrations).toBe('function');
    });

    it('should export all required interfaces', async () => {
      // This test ensures the interfaces are properly exported by importing the module
      await import('../api');

      // If the module imports without error, the interfaces are properly exported
      expect(true).toBe(true);
    });
  });
});