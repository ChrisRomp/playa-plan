import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, ArrayMinSize, ValidateNested, IsArray, IsIn, IsBoolean, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { NotificationType } from '@prisma/client';

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
  @ApiProperty({ description: 'Recipient email address', example: 'user@example.playaplan.app' })
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

  @ApiPropertyOptional({ 
    description: 'Type of notification for audit purposes',
    enum: NotificationType,
    example: NotificationType.EMAIL_VERIFICATION
  })
  @IsOptional()
  @IsEnum(NotificationType)
  notificationType?: NotificationType;

  @ApiPropertyOptional({ description: 'Email attachments' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

export class SendEmailToMultipleRecipientsDto {
  @ApiProperty({ description: 'Recipient email addresses', example: ['user1@example.playaplan.app', 'user2@example.playaplan.app'] })
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

  @ApiPropertyOptional({ 
    description: 'Type of notification for audit purposes',
    enum: NotificationType,
    example: NotificationType.EMAIL_VERIFICATION
  })
  @IsOptional()
  @IsEnum(NotificationType)
  notificationType?: NotificationType;

  @ApiPropertyOptional({ description: 'Email attachments' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

export class SendTestEmailDto {
  @ApiProperty({ 
    description: 'Email address(es) to send test email to. Can be a single email or comma-separated list.',
    example: 'test@example.com' 
  })
  @IsString()
  email: string;

  @ApiPropertyOptional({ 
    description: 'Custom subject for the test email. If not provided, a default test subject will be used.',
    example: 'Custom Test Email Subject' 
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ 
    description: 'Custom message content for the test email. If not provided, default test content will be used.',
    example: 'This is a custom test message content.' 
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ 
    description: 'Email format - HTML or plain text',
    example: 'html',
    enum: ['html', 'text']
  })
  @IsOptional()
  @IsIn(['html', 'text'])
  format?: 'html' | 'text';

  @ApiPropertyOptional({ 
    description: 'Whether to include SMTP configuration details in the email content',
    example: true 
  })
  @IsOptional()
  @IsBoolean()
  includeSmtpDetails?: boolean;
}

export class TestSmtpConnectionDto {
  @ApiPropertyOptional({ 
    description: 'Whether email notifications are enabled',
    example: true 
  })
  @IsOptional()
  @IsBoolean()
  emailEnabled?: boolean;

  @ApiPropertyOptional({ 
    description: 'SMTP server hostname',
    example: 'smtp.gmail.com' 
  })
  @IsOptional()
  @IsString()
  smtpHost?: string;

  @ApiPropertyOptional({ 
    description: 'SMTP server port',
    example: 587,
    minimum: 1,
    maximum: 65535
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(65535)
  smtpPort?: number;

  @ApiPropertyOptional({ 
    description: 'SMTP username',
    example: 'user@example.com' 
  })
  @IsOptional()
  @IsString()
  smtpUsername?: string;

  @ApiPropertyOptional({ 
    description: 'SMTP password',
    example: 'password123' 
  })
  @IsOptional()
  @IsString()
  smtpPassword?: string;

  @ApiPropertyOptional({ 
    description: 'Whether to use SSL for SMTP connection',
    example: false 
  })
  @IsOptional()
  @IsBoolean()
  smtpUseSsl?: boolean;

  @ApiPropertyOptional({ 
    description: 'Sender email address',
    example: 'noreply@example.com' 
  })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }: { value: string }) => value === '' ? undefined : value)
  senderEmail?: string;

  @ApiPropertyOptional({ 
    description: 'Sender name',
    example: 'Camp Organization' 
  })
  @IsOptional()
  @IsString()
  senderName?: string;

  @ApiPropertyOptional({ 
    description: 'Reply-to email address',
    example: 'admin@example.com' 
  })
  @IsOptional()
  @IsEmail()
  @Transform(({ value }: { value: string }) => value === '' ? undefined : value)
  replyTo?: string;
}