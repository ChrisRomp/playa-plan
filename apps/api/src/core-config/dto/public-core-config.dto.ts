import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for public core configuration responses
 * Contains fields needed for rendering UI elements and meeting schema validation
 * Available without authentication
 */
export class PublicCoreConfigDto {
  /**
   * Unique identifier
   */
  @ApiProperty({
    description: 'Unique identifier',
    example: 'clk1234abcdef'
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
   * Stripe public key
   */
  @ApiProperty({
    description: 'Stripe public key',
    example: 'pk_test_...'
  })
  stripePublicKey!: string | null;

  /**
   * Whether PayPal is enabled
   */
  @ApiProperty({
    description: 'Whether PayPal is enabled',
    example: false
  })
  paypalEnabled!: boolean;

  /**
   * PayPal client ID
   */
  @ApiProperty({
    description: 'PayPal client ID',
    example: 'client_id_...'
  })
  paypalClientId!: string | null;

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
   * Site time zone
   */
  @ApiProperty({
    description: 'Site time zone',
    example: 'America/Los_Angeles'
  })
  timeZone!: string;

  /**
   * Date when the configuration was created (ISO string)
   */
  @ApiProperty({
    description: 'Date when the configuration was created (ISO string)',
    example: '2023-01-01T00:00:00.000Z'
  })
  createdAt!: string;

  /**
   * Date when the configuration was last updated (ISO string)
   */
  @ApiProperty({
    description: 'Date when the configuration was last updated (ISO string)',
    example: '2023-01-01T00:00:00.000Z'
  })
  updatedAt!: string;

  constructor(partial: Partial<PublicCoreConfigDto>) {
    Object.assign(this, partial);
  }
}
