import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReorderFieldsDto, FieldOrderDto } from './reorder-fields.dto';

describe('ReorderFieldsDto', () => {
  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      const plainObject = {
        fieldOrders: [
          { id: 'e3e4f056-ee1c-4729-80a1-4611403e2217', order: 0 },
          { id: 'dad1fd3b-a10c-4fd5-9fdc-2067c63c6a12', order: 1 }
        ]
      };

      const dto = plainToInstance(ReorderFieldsDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation when fieldOrders is missing', async () => {
      const plainObject = {
        someOtherProperty: 'invalid'
      };

      const dto = plainToInstance(ReorderFieldsDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('fieldOrders');
      expect(errors[0].constraints).toHaveProperty('isArray');
    });

    it('should fail validation when fieldOrders is not an array', async () => {
      const plainObject = {
        fieldOrders: 'not-an-array'
      };

      const dto = plainToInstance(ReorderFieldsDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('fieldOrders');
      expect(errors[0].constraints).toHaveProperty('isArray');
    });

    it('should fail validation when field ID is not a UUID', async () => {
      const plainObject = {
        fieldOrders: [
          { id: 'not-a-uuid', order: 0 }
        ]
      };

      const dto = plainToInstance(ReorderFieldsDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('fieldOrders');
      expect(errors[0].children).toBeDefined();
      expect(errors[0].children![0].property).toBe('0');
      expect(errors[0].children![0].children![0].property).toBe('id');
      expect(errors[0].children![0].children![0].constraints).toHaveProperty('isUuid');
    });

    it('should fail validation when order is negative', async () => {
      const plainObject = {
        fieldOrders: [
          { id: 'e3e4f056-ee1c-4729-80a1-4611403e2217', order: -1 }
        ]
      };

      const dto = plainToInstance(ReorderFieldsDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('fieldOrders');
      expect(errors[0].children).toBeDefined();
      expect(errors[0].children![0].children![0].property).toBe('order');
      expect(errors[0].children![0].children![0].constraints).toHaveProperty('min');
    });

    it('should fail validation when order is missing', async () => {
      const plainObject = {
        fieldOrders: [
          { id: 'e3e4f056-ee1c-4729-80a1-4611403e2217' }
        ]
      };

      const dto = plainToInstance(ReorderFieldsDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('fieldOrders');
      expect(errors[0].children).toBeDefined();
      expect(errors[0].children![0].children![0].property).toBe('order');
      expect(errors[0].children![0].children![0].constraints).toHaveProperty('isNumber');
    });

    it('should fail validation when id is missing', async () => {
      const plainObject = {
        fieldOrders: [
          { order: 0 }
        ]
      };

      const dto = plainToInstance(ReorderFieldsDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('fieldOrders');
      expect(errors[0].children).toBeDefined();
      expect(errors[0].children![0].children![0].property).toBe('id');
      expect(errors[0].children![0].children![0].constraints).toHaveProperty('isUuid');
    });
  });
});

describe('FieldOrderDto', () => {
  describe('validation', () => {
    it('should pass validation with valid data', async () => {
      const plainObject = {
        id: 'e3e4f056-ee1c-4729-80a1-4611403e2217',
        order: 0
      };

      const dto = plainToInstance(FieldOrderDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    });

    it('should fail validation when id is not a UUID', async () => {
      const plainObject = {
        id: 'not-a-uuid',
        order: 0
      };

      const dto = plainToInstance(FieldOrderDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('id');
      expect(errors[0].constraints).toHaveProperty('isUuid');
    });

    it('should fail validation when order is negative', async () => {
      const plainObject = {
        id: 'e3e4f056-ee1c-4729-80a1-4611403e2217',
        order: -1
      };

      const dto = plainToInstance(FieldOrderDto, plainObject);
      const errors = await validate(dto);

      expect(errors).toHaveLength(1);
      expect(errors[0].property).toBe('order');
      expect(errors[0].constraints).toHaveProperty('min');
    });
  });
}); 