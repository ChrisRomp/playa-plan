import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, ArrayMinSize, ValidateNested, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

export class AttachmentDto {
  @ApiProperty({ description: 'Filename of the attachment' })
  @IsString()
  @IsNotEmpty()
  filename = '';

  @ApiProperty({ description: 'Content of the attachment as string (base64 for binary files)' })
  @IsString()
  @IsNotEmpty()
  content = '';

  @ApiPropertyOptional({ description: 'Content type of the attachment' })
  @IsString()
  @IsOptional()
  contentType?: string;
}

export class SendEmailDto {
  @ApiProperty({ description: 'Recipient email address', example: 'user@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  to = '';

  @ApiProperty({ description: 'Email subject', example: 'Account Confirmation' })
  @IsString()
  @IsNotEmpty()
  subject = '';

  @ApiProperty({ description: 'Email HTML content' })
  @IsString()
  @IsNotEmpty()
  html = '';

  @ApiPropertyOptional({ description: 'Plain text version of the email' })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional({ description: 'Email attachments' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

export class SendEmailToMultipleRecipientsDto {
  @ApiProperty({ description: 'Recipient email addresses', example: ['user1@example.com', 'user2@example.com'] })
  @IsArray()
  @ArrayMinSize(1)
  @IsEmail({}, { each: true, message: 'Each recipient must be a valid email address' })
  to: string[] = [];

  @ApiProperty({ description: 'Email subject', example: 'Important Announcement' })
  @IsString()
  @IsNotEmpty()
  subject = '';

  @ApiProperty({ description: 'Email HTML content' })
  @IsString()
  @IsNotEmpty()
  html = '';

  @ApiPropertyOptional({ description: 'Plain text version of the email' })
  @IsString()
  @IsOptional()
  text?: string;

  @ApiPropertyOptional({ description: 'Email attachments' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
} 