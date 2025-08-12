import { ApiProperty } from '@nestjs/swagger';

/**
 * Entity representing the core site configuration
 */
export class CoreConfig {
  /**
   * Unique identifier for the configuration
   */
  @ApiProperty({
    description: 'Unique identifier for the configuration',
    example: 'c12345-67890'
  })
  id!: string;

  /**
   * Camp name
   */
  @ApiProperty({
    description: 'Camp name',
    example: 'Camp Awesome'
  })
  campName!: string;

  /**
   * Camp description (HTML allowed)
   */
  @ApiProperty({
    description: 'Camp description (HTML allowed)',
    example: '<p>Welcome to Camp Awesome!</p>'
  })
  campDescription!: string | null;

  /**
   * Home page blurb (HTML allowed)
   */
  @ApiProperty({
    description: 'Home page blurb (HTML allowed)',
    example: '<p>Register for our amazing camp!</p>'
  })
  homePageBlurb!: string | null;

  /**
   * Camp banner URL
   */
  @ApiProperty({
    description: 'Camp banner URL',
    example: 'https://mycamp.playaplan.app/banner.jpg'
  })
  campBannerUrl!: string | null;

  /**
   * Alt text for the camp banner image (for accessibility)
   */
  @ApiProperty({
    description: 'Alt text for the camp banner image (for accessibility)',
    example: 'Beautiful sunset view of Camp Awesome with mountains in the background'
  })
  campBannerAltText!: string | null;

  /**
   * Camp icon URL
   */
  @ApiProperty({
    description: 'Camp icon URL',
    example: 'https://mycamp.playaplan.app/icon.png'
  })
  campIconUrl!: string | null;

  /**
   * Alt text for the camp icon image (for accessibility)
   */
  @ApiProperty({
    description: 'Alt text for the camp icon image (for accessibility)',
    example: 'Camp Awesome logo with a stylized tent icon'
  })
  campIconAltText!: string | null;

  /**
   * Registration year
   */
  @ApiProperty({
    description: 'Registration year',
    example: 2023
  })
  registrationYear!: number;

  /**
   * Whether early registration is open
   */
  @ApiProperty({
    description: 'Whether early registration is open',
    example: false
  })
  earlyRegistrationOpen!: boolean;

  /**
   * Whether registration is open
   */
  @ApiProperty({
    description: 'Whether registration is open',
    example: true
  })
  registrationOpen!: boolean;

  /**
   * Registration terms (HTML allowed)
   */
  @ApiProperty({
    description: 'Registration terms (HTML allowed)',
    example: '<p>By registering, you agree to our terms...</p>'
  })
  registrationTerms!: string | null;

  /**
   * Whether to allow deferred dues payment
   */
  @ApiProperty({
    description: 'Whether to allow deferred dues payment',
    example: false
  })
  allowDeferredDuesPayment!: boolean;

  /**
   * Whether Stripe is enabled
   */
  @ApiProperty({
    description: 'Whether Stripe is enabled',
    example: true
  })
  stripeEnabled!: boolean;

  /**
   * Stripe public key (hidden from responses)
   */
  @ApiProperty({
    description: 'Stripe public key',
    example: 'pk_test_...',
    required: false
  })
  stripePublicKey!: string | null;

  /**
   * Stripe API key (hidden from responses)
   */
  @ApiProperty({
    description: 'Stripe API key',
    example: 'sk_test_...',
    required: false
  })
  stripeApiKey!: string | null;

  /**
   * Whether PayPal is enabled
   */
  @ApiProperty({
    description: 'Whether PayPal is enabled',
    example: false
  })
  paypalEnabled!: boolean;

  /**
   * PayPal client ID (hidden from responses)
   */
  @ApiProperty({
    description: 'PayPal client ID',
    example: 'client_id_...',
    required: false
  })
  paypalClientId!: string | null;

  /**
   * PayPal client secret (hidden from responses)
   */
  @ApiProperty({
    description: 'PayPal client secret',
    example: 'client_secret_...',
    required: false
  })
  paypalClientSecret!: string | null;

  /**
   * PayPal mode (sandbox or live)
   */
  @ApiProperty({
    description: 'PayPal mode (sandbox or live)',
    example: 'sandbox',
    enum: ['sandbox', 'live']
  })
  paypalMode!: string;

  /**
   * SMTP host
   */
  @ApiProperty({
    description: 'SMTP host',
    example: 'smtp.mycamp.playaplan.app',
    required: false
  })
  smtpHost!: string | null;

  /**
   * SMTP port
   */
  @ApiProperty({
    description: 'SMTP port',
    example: 587,
    required: false
  })
  smtpPort!: number | null;

  /**
   * SMTP username (hidden from responses)
   */
  @ApiProperty({
    description: 'SMTP username',
    example: 'username',
    required: false
  })
  smtpUsername!: string | null;

  /**
   * SMTP password (hidden from responses)
   */
  @ApiProperty({
    description: 'SMTP password',
    example: 'password',
    required: false
  })
  smtpPassword!: string | null;

  /**
   * SMTP use SSL
   */
  @ApiProperty({
    description: 'SMTP use SSL',
    example: false,
    required: false
  })
  smtpUseSsl!: boolean;

  /**
   * Sender email address
   */
  @ApiProperty({
    description: 'Sender email address',
    example: 'no-reply@example.playaplan.app',
    required: false
  })
  senderEmail!: string | null;

  /**
   * Sender name
   */
  @ApiProperty({
    description: 'Sender name',
    example: 'Camp Awesome',
    required: false
  })
  senderName!: string | null;

  /**
   * Reply-to email address
   */
  @ApiProperty({
    description: 'Reply-to email address',
    example: 'replies@example.playaplan.app',
    required: false
  })
  replyTo!: string | null;

  /**
   * Whether email sending is enabled globally
   */
  @ApiProperty({
    description: 'Whether email sending is enabled globally',
    example: false
  })
  emailEnabled!: boolean;

  /**
   * Date when the configuration was created
   */
  @ApiProperty({
    description: 'Date when the configuration was created',
    example: '2023-01-01T00:00:00.000Z'
  })
  createdAt!: Date;

  /**
   * Date when the configuration was last updated
   */
  @ApiProperty({
    description: 'Date when the configuration was last updated',
    example: '2023-01-01T00:00:00.000Z'
  })
  updatedAt!: Date;

  constructor(partial: Partial<CoreConfig>) {
    Object.assign(this, partial);
  }
} 