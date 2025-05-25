import { ApiProperty } from '@nestjs/swagger';

/**
 * Enum for field data types
 */
export enum FieldType {
  STRING = 'STRING',
  MULTILINE_STRING = 'MULTILINE_STRING',
  INTEGER = 'INTEGER',
  NUMBER = 'NUMBER',
  BOOLEAN = 'BOOLEAN',
  DATE = 'DATE'
}

/**
 * Entity representing a custom field for a camping option
 * Maps to the CampingOptionField model in Prisma
 */
export class CampingOptionField {
  /**
   * Unique identifier for the camping option field
   */
  @ApiProperty({
    description: 'Unique identifier for the camping option field',
    example: 'f12345-67890'
  })
  id!: string;
  
  /**
   * Display name of the field
   */
  @ApiProperty({
    description: 'Display name of the field',
    example: 'Dietary Restrictions'
  })
  displayName!: string;
  
  /**
   * Description of the field
   */
  @ApiProperty({
    description: 'Description of the field',
    example: 'Please list any dietary restrictions or allergies',
    nullable: true
  })
  description!: string | null;
  
  /**
   * Data type of the field
   */
  @ApiProperty({
    description: 'Data type of the field',
    enum: FieldType,
    example: FieldType.STRING
  })
  dataType!: FieldType;
  
  /**
   * Whether the field is required
   */
  @ApiProperty({
    description: 'Whether the field is required',
    example: false,
    default: false
  })
  required!: boolean;
  
  /**
   * Maximum length for string fields
   */
  @ApiProperty({
    description: 'Maximum length for string fields',
    example: 255,
    nullable: true
  })
  maxLength!: number | null;
  
  /**
   * Minimum value for numeric fields
   */
  @ApiProperty({
    description: 'Minimum value for numeric fields',
    example: 0,
    nullable: true
  })
  minValue!: number | null;
  
  /**
   * Maximum value for numeric fields
   */
  @ApiProperty({
    description: 'Maximum value for numeric fields',
    example: 100,
    nullable: true
  })
  maxValue!: number | null;
  
  /**
   * Display order of the field
   */
  @ApiProperty({
    description: 'Display order of the field (lower numbers appear first)',
    example: 1
  })
  order!: number;
  
  /**
   * ID of the camping option this field belongs to
   */
  @ApiProperty({
    description: 'ID of the camping option this field belongs to',
    example: 'c12345-67890'
  })
  campingOptionId!: string;
  
  /**
   * Date when the field was created
   */
  @ApiProperty({
    description: 'Date when the field was created',
    example: '2023-01-01T00:00:00.000Z'
  })
  createdAt!: Date;
  
  /**
   * Date when the field was last updated
   */
  @ApiProperty({
    description: 'Date when the field was last updated',
    example: '2023-01-01T00:00:00.000Z'
  })
  updatedAt!: Date;
  
  constructor(partial: Partial<CampingOptionField>) {
    Object.assign(this, partial);
  }
  
  /**
   * Validates a value against this field's constraints
   */
  validateValue(value: string | number | boolean | Date): { valid: boolean; message?: string } {
    if (this.required && (value === null || value === undefined || value === '')) {
      return { valid: false, message: `${this.displayName} is required` };
    }
    
    // Skip other validations if the value is empty and not required
    if (value === null || value === undefined || value === '') {
      return { valid: true };
    }
    
    switch (this.dataType) {
      case FieldType.STRING:
      case FieldType.MULTILINE_STRING:
        if (this.maxLength && value.toString().length > this.maxLength) {
          return { 
            valid: false, 
            message: `${this.displayName} must be at most ${this.maxLength} characters`
          };
        }
        break;
        
      case FieldType.INTEGER:
        if (!Number.isInteger(Number(value))) {
          return { valid: false, message: `${this.displayName} must be an integer` };
        }
        // Fall through to number validation
        
      case FieldType.NUMBER:
        const numValue = Number(value);
        if (isNaN(numValue)) {
          return { valid: false, message: `${this.displayName} must be a number` };
        }
        
        if (this.minValue !== null && numValue < this.minValue) {
          return { 
            valid: false, 
            message: `${this.displayName} must be at least ${this.minValue}` 
          };
        }
        
        if (this.maxValue !== null && numValue > this.maxValue) {
          return { 
            valid: false, 
            message: `${this.displayName} must be at most ${this.maxValue}` 
          };
        }
        break;
        
      case FieldType.BOOLEAN:
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          return { valid: false, message: `${this.displayName} must be a boolean value` };
        }
        break;
        
      case FieldType.DATE:
        if (typeof value === 'boolean') {
          return { valid: false, message: `${this.displayName} must be a valid date` };
        }
        
        const date = new Date(value as string | number | Date);
        if (isNaN(date.getTime())) {
          return { valid: false, message: `${this.displayName} must be a valid date` };
        }
        break;
    }
    
    return { valid: true };
  }
} 