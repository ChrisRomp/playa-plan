import { ApiProperty } from '@nestjs/swagger';
import { 
  IsString, 
  IsBoolean, 
  IsNumber, 
  IsUrl, 
  IsEmail, 
  IsIn, 
  IsOptional, 
  Min, 
  Max, 
  Length, 
  IsInt
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsUrlOrRelativePath } from '../validators/is-url-or-relative-path.validator';

/**
 * DTO for creating a new core configuration
 */
export class CreateCoreConfigDto {
  /**
   * Camp name
   */
  @ApiProperty({
    description: 'Camp name',
    example: 'Camp Awesome'
  })
  @IsString()
  @Length(1, 100)
  campName!: string;

  /**
   * Camp description (HTML allowed)
   */
  @ApiProperty({
    description: 'Camp description (HTML allowed)',
    example: '<p>Welcome to Camp Awesome!</p>',
    required: false
  })
  @IsString()
  @IsOptional()
  campDescription?: string;

  /**
   * Home page blurb (HTML allowed)
   */
  @ApiProperty({
    description: 'Home page blurb (HTML allowed)',
    example: '<p>Register for our amazing camp!</p>',
    required: false
  })
  @IsString()
  @IsOptional()
  homePageBlurb?: string;

  /**
   * Camp banner URL
   */
  @ApiProperty({
    description: 'Camp banner URL (can be a full URL or a relative path starting with /)',
    example: '/images/banner.jpg',
    required: false
  })
  @IsUrlOrRelativePath({
    message: 'campBannerUrl must be either a valid URL or a relative path starting with /'
  })
  @IsOptional()
  campBannerUrl?: string;

  /**
   * Alt text for the camp banner image (for accessibility)
   */
  @ApiProperty({
    description: 'Alt text for the camp banner image (for accessibility)',
    example: 'Beautiful sunset view of Camp Awesome with mountains in the background',
    required: false
  })
  @IsString()
  @IsOptional()
  @Length(0, 250)
  campBannerAltText?: string;

  /**
   * Camp icon URL
   */
  @ApiProperty({
    description: 'Camp icon URL (can be a full URL or a relative path starting with /)',
    example: '/icons/icon.png',
    required: false
  })
  @IsUrlOrRelativePath({
    message: 'campIconUrl must be either a valid URL or a relative path starting with /'
  })
  @IsOptional()
  campIconUrl?: string;

  /**
   * Alt text for the camp icon image (for accessibility)
   */
  @ApiProperty({
    description: 'Alt text for the camp icon image (for accessibility)',
    example: 'Camp Awesome logo with a stylized tent icon',
    required: false
  })
  @IsString()
  @IsOptional()
  @Length(0, 250)
  campIconAltText?: string;

  /**
   * Registration year
   */
  @ApiProperty({
    description: 'Registration year',
    example: 2023
  })
  @IsInt()
  @Min(2000)
  @Max(2100)
  @Type(() => Number)
  registrationYear!: number;

  /**
   * Whether early registration is open
   */
  @ApiProperty({
    description: 'Whether early registration is open',
    example: false,
    default: false
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  earlyRegistrationOpen?: boolean = false;

  /**
   * Whether registration is open
   */
  @ApiProperty({
    description: 'Whether registration is open',
    example: true,
    default: false
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  registrationOpen?: boolean = false;

  /**
   * Registration terms (HTML allowed)
   */
  @ApiProperty({
    description: 'Registration terms (HTML allowed)',
    example: '<p>By registering, you agree to our terms...</p>',
    required: false
  })
  @IsString()
  @IsOptional()
  registrationTerms?: string;

  /**
   * Whether to allow deferred dues payment
   */
  @ApiProperty({
    description: 'Whether to allow deferred dues payment',
    example: false,
    default: false
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  allowDeferredDuesPayment?: boolean = false;

  /**
   * Whether Stripe is enabled
   */
  @ApiProperty({
    description: 'Whether Stripe is enabled',
    example: true,
    default: false
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  stripeEnabled?: boolean = false;

  /**
   * Stripe public key
   */
  @ApiProperty({
    description: 'Stripe public key',
    example: 'pk_test_...',
    required: false
  })
  @IsString()
  @IsOptional()
  stripePublicKey?: string;

  /**
   * Stripe API key
   */
  @ApiProperty({
    description: 'Stripe API key',
    example: 'sk_test_...',
    required: false
  })
  @IsString()
  @IsOptional()
  stripeApiKey?: string;

  /**
   * Stripe webhook secret
   */
  @ApiProperty({
    description: 'Stripe webhook secret',
    example: 'whsec_...',
    required: false
  })
  @IsString()
  @IsOptional()
  stripeWebhookSecret?: string;

  /**
   * Whether PayPal is enabled
   */
  @ApiProperty({
    description: 'Whether PayPal is enabled',
    example: false,
    default: false
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  paypalEnabled?: boolean = false;

  /**
   * PayPal client ID
   */
  @ApiProperty({
    description: 'PayPal client ID',
    example: 'client_id_...',
    required: false
  })
  @IsString()
  @IsOptional()
  paypalClientId?: string;

  /**
   * PayPal client secret
   */
  @ApiProperty({
    description: 'PayPal client secret',
    example: 'client_secret_...',
    required: false
  })
  @IsString()
  @IsOptional()
  paypalClientSecret?: string;

  /**
   * PayPal mode (sandbox or live)
   */
  @ApiProperty({
    description: 'PayPal mode (sandbox or live)',
    example: 'sandbox',
    enum: ['sandbox', 'live'],
    default: 'sandbox'
  })
  @IsIn(['sandbox', 'live'])
  @IsOptional()
  paypalMode?: string = 'sandbox';

  /**
   * SMTP host
   */
  @ApiProperty({
    description: 'SMTP host',
    example: 'smtp.playaplan.app',
    required: false
  })
  @IsString()
  @IsOptional()
  smtpHost?: string;

  /**
   * SMTP port
   */
  @ApiProperty({
    description: 'SMTP port',
    example: 587,
    required: false
  })
  @IsNumber()
  @Min(1)
  @Max(65535)
  @IsOptional()
  @Type(() => Number)
  smtpPort?: number;

  /**
   * SMTP username
   */
  @ApiProperty({
    description: 'SMTP username',
    example: 'username',
    required: false
  })
  @IsString()
  @IsOptional()
  smtpUsername?: string;

  /**
   * SMTP password
   */
  @ApiProperty({
    description: 'SMTP password',
    example: 'password',
    required: false
  })
  @IsString()
  @IsOptional()
  smtpPassword?: string;

  /**
   * SMTP use SSL
   */
  @ApiProperty({
    description: 'SMTP use SSL',
    example: false,
    default: false
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  smtpUseSsl?: boolean = false;

  /**
   * Sender email address
   */
  @ApiProperty({
    description: 'Sender email address',
    example: 'no-reply@example.playaplan.app',
    required: false
  })
  @IsEmail()
  @IsOptional()
  senderEmail?: string;

  /**
   * Sender name
   */
  @ApiProperty({
    description: 'Sender name',
    example: 'Camp Awesome',
    required: false
  })
  @IsString()
  @IsOptional()
  senderName?: string;

  /**
   * Site time zone
   */
  @ApiProperty({
    description: 'Site time zone',
    example: 'America/Los_Angeles',
    default: 'UTC'
  })
  @IsString()
  @IsOptional()
  timeZone?: string = 'UTC';
} 