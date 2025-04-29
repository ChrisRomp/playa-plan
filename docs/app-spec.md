# Overview

PlayaPlan is intended to be a web application used by a Burning Man theme camp to facilitate sign-ups for their camp in a given year. Each deployment will be personalized to show information for a specific camp from configuration, and can have colors/themes adjusted to suit that camp's preferences.

# Users

## Roles

There are three roles of users:

1. Participant: This is the default user role.
2. Staff: This is for camp staff who should be able to see camp reports and some additional information on users.
3. Admin: This is for app/camp administrators, and will have all permissions to the site, including user management, configuration, access to payments and refunds, and anything else.
### Anonymous Users
Any site visitor not logged in is considered an anonymous user. The front page information should be shown, and these can be allowed to sign up as a user.

## Authentication

Since this process occurs only once per year, we want to simplify the authentication process for users as much as possible. By default when a user enters their email address, they will be sent an authorization code, which they will then enter on the site. 

Upon successful login a JWT is issued and persisted in the browser session. The JWT should contain the user's first name, last name, playa name, email, role, and any other required validation info for AuthN/AuthZ flows and UI elements without having to retrieve the full profile again.

### Passwords

Password functionality may be added in the future, but not in the initial release.

### Social Logins

Social logins (Google, Facebook, etc.) may be added in the future, but not in the initial release.

## User Registration

When a user creates an account on the website they must first complete the email verification-based authentication process. Upon successful authentication, they are a "Participant" role user. They will be asked to complete a user profile. Other functionality is not available until a user profile is completed.

### User Profile

A user's profile contains the following information:
1. Id: Not shown to the user - a guid/uuid string, used as the primary key
2. Email: Required, must be unique
3. Email confirmed: boolean, default false, hidden from user; editable by staff/admin
4. First Name: required string
5. Last Name: required string
6. Playa Name: optional string
7. Phone: optional string
8. City & State/Province: optional string
9. Country: optional string
10. Emergency contact info: optional string - will present as a multi-line plaintext area
11. Allow Registration: boolean, default true, hidden from user; editable by staff/admin
12. Allow Early Registration: boolean, default false, hidden from user; editable by staff/admin
13. Allow deferred dues payment: boolean, default false, hidden from user/staff; editable by admin
14. Allow no job: boolean, default false, editable by staff/admin
15. Internal Notes: optional string, hidden from user; editable by staff/admin
16. Role: hidden from user/staff, editable by admin: Enum for Participant/Staff/Admin

### Profile Customization

A site admin may make some user-visible optional profile fields required. We may add functionality to add additional custom fields in the future without changing the source code, but that's not a hard requirement for the first release.

## Changing Email

A user may update their email address through a validation process. That process should include:

1. Existing email verification
2. New email verification
3. Email notification to old and new emails about the change after the fact
4. Some kind of history log recording the change

# Registration

When a user registers for camp for a given year (per the registration year in configuration), they are shown their profile information once more to confirm the details. They will then choose from one or more available camping options (details below), and select any required work shift(s) based on those camping options (unless the user profile has "Allow no job" checked). There may also be a globally-required work shift(s) not associated with a camping option.

Staff and Admin users may also register for camping.

## Terms

The last field on the registration form will show the registration terms from core configuration, if present (not an empty/whitespace string). The user must accept these terms to complete the registration process.

## Dues/Payment

The camping membership dues are calculated based on the cost of the camping option(s) selected. If there are no dues associated with any of the selected camping options, there is no payment necessary and the completion button should read "Save Registration". If dues are required, the completion button should say "Pay Dues" and this will initiate the payment process. The user can select Stripe or PayPal payment processing, depending on which option(s) are configured in Core Configuration.

### Deferred Payment

If the Core Configuration option for allowed deferred dues payment is enabled, or the user profile field for the same is enabled, then instead of the "Pay Dues" button, the user will be shown the "Save Registration" button. They will receive a notice that their registration is not complete until the camp receives the dues payment.

### Payment Failure

If payment fails, persist the registration record with a status of Pending. Notify the user of the error and that their registration is not complete until the camp receives the dues payment. The user will be able to pay unpaid dues later (see Modifying Registration, below).

## Status

Status options for registrations

- Pending - partial registrations or unpaid dues
- Complete
- Cancelled
- Error

# Camping Options

A camp may configure different options for registering and may show one or more options to users upon registration.

*Note: This is replacing the "Skydiving" and "Camping" options from the previous registration website and making them configurable.*

Each camping options defines:

- Name
- Enabled - boolean, default true
- Work shift(s) required - int, default 0
- Job categories: Which categories of jobs to show during registration - optional unless shift(s) required is > 0
- Participant dues - numeric, required
- Staff dues: dues for staff/admin users - numeric, required
- Maximum sign-ups - numeric, required, 0 = unlimited
- Fields configuration (see below)

When work shift(s) are required, the user must select at least that number of shifts. Available shifts should be presented to the user for jobs of the selected category(ies) where the number of sign-ups is less than the maximum number specified for a shift.

If no shifts are available (i.e., they are all full), then allow the registration to continue but notify the user that they will have to sign up for a work shift at a later date.

If a camping option is full (has the  maximum sign-ups allowed), it should still be displayed to the user but not selectable and annotated as "(Full)".

## Fields

Additional information may be required depending on the camping options selected. The configuration for camping options should allow for defining additional fields to be shown during the registration process. The admin should be able to configure:

- Display name
- Field description
- Data type - string (single or multi-line), integer, number, checkbox (boolean), or date
- Required - whether the field is required to complete registration
- Validation options - min/max values for integer/number fields, or max length for string fields

*Note: This is replacing the functionality that enabled collecting skydiving-specific info for skydivers, and camping-specific info for campers.*

# Camp Work

Most theme camps are only able to operate if their members work during the event.

## Job Categories

Defines categories of jobs. Some examples may be kitchen help, camp helper, MOOP/cleanup, building, or teardown. Job categories are editable by admin users.

- Id: string, required, default a value using some pattern derived from the Name
- Name: string, required
- Description: string, optional
- Location: string, optional
- Staff only: boolean, default false
- Always required: boolean, default false

An "always required" job will present available shifts for all registrations, regardless of camping options selected, and will be required to complete the registration. An example of this could be "tear-down help" where all campers are expected to help take a shift for tearing down camp.

## Job Shifts

Defines the day and time of a job. The main part of Burning Man is Sunday through Sunday, and since this website will operate year over year, we should not require picking a specific date, but rather a day of the week. Some shifts may be defined as daily or ongoing. Some shifts may operate pre-opening and after the event, so we can use as day options:

- Pre-opening
- Opening Sunday
- Monday
- Tuesday
- Wednesday
- Thursday
- Friday
- Saturday
- Closing Sunday
- Post-event
- Daily/Ongoing

A shift will include:

- Id, string, required, derive a pattern from category, day, time if practical
- Name, string, required
- Day, select (see above), required
- Start time, time of day, required, default 0:00
- End time, time of day, required, default 23:59

Job shifts are editable by admin users.

## Jobs

A job is the work type and shift as selectable by a user during registration. Jobs are editable by admin users.

- Id: string, required, derive a pattern from category/day or name field
- Name: Name of the job, required string
- Job category
- Job shift
- Enabled, boolean, default true
- Max available: maximum number of sign-ups to allow, int

If a shift has the maximum number of users signed up, that shift will not present as an option for new registrations.

## Work Schedule

The user can view the work schedule to see what other users have signed up for non-staff jobs. The schedule should be grouped by day then category.

# Viewing Registration Details

After a user has signed up, they will be able to see their registration selections. If they signed up for any work shifts, they will be able to see that information shown with their registration. Any dues payments should be shown here as well.

## Modifying Registration Details

A user may edit their work shift and sign up for another allowed job category or shift for their select job category/categories.

A user may add additional camping options if available.

If a user deferred dues payment or had a payment error, they may make a payment for any unpaid dues balance using a configured payment option.

# Notifications
The application should be configured to send email notifications to users. Some notifications include:

- Email authentication
- Email change notifications
- Registration confirmation including dues paid shown
	- Formal receipts will come from payment processors
- Registration change confirmations
	- E.g., user changed their shift
- Admin: Notify when a camping option is full

Users should not receive email notifications for changes by staff/admins

# Reporting/Dashboards

These reports should only be accessible to staff or admin users.

### Work Schedule

Staff/Admin users can view the work schedule to see what other users have signed up for, including staff-only jobs. The schedule should be grouped by day then category.

## Registration Dashboard

A report of all registrations. Should include the ability to group/filter by camping options selected. By default should only include pending and complete registrations, grouping by status.

Staff may drill into a details view, and adjust a user's job shift information, or drill into the user's profile details.

Admins will be able to see associated payment/refund information in a registration details view.

# Admin Functions

These functional areas should only be accessible to admin users.

## Core Configuration

The core website configuration for a camp's implementation of PlayaPlan for personalizing the site. 

Contains:
- Camp Info
	- Camp name - string, required
	- Camp description - rich text (HTML), optional
	- Home page blurb - rich text (HTML), optional
	- Camp banner URL
	- Camp icon URL
- Registration
	- Registration year - int, required
	- Early registration open - boolean, default false
	- Registration open - boolean, default false
	- Registration terms - string (HTML), default empty string
	- Allow deferred dues payment - boolean, default false
- Payment Processing
	- Stripe enabled - boolean, default false
	- Stripe public key - string, optional, password/secure
	- Stripe api key - string, optional, password/secure
	- Stripe webhook secret - string, optional, password/secure
	- PayPal enabled - boolean, default false
	- PayPal client ID - string, optional, password/secure
	- PayPal client secret - string, optional, password/secure
	- PayPal mode - choice: sandbox/live, default sandbox
- Email Configuration
	- SMTP configuration fields
- Site Configuration
	- Time zone

## Job/Shift Configurations

Job category, shifts, and job configuration data are only editable by admin users.

## Payment Management

Admin users may view a list of all payments and refunds by all users including the payment type, date/time, amount

### Manual Payments

Admin users may record manual payments, which will include the ability to record the processor type (including manual) and payment ID, amount, and associate it with a user's registration. This view should also provide the ability to modify the registration status, i.e., change it to Complete when paid in full.

### Refunds

Admin users should be able to initiate a refund. For payment processor (Stripe, PayPal) payments, this should use an automated process via the API. For manual payments, the necessary information can be recorded. This view should also provide the ability to modify the registration status, e.g., Complete, Pending, Cancelled.

# Data Views

Views which display data tables, particularly in admin areas or reports, should use a common set of controls for viewing that data. Where practical, it should include:

- Sorting options (by column)
- Column-level filtering
- Grouping options
- A global search
- Export to CSV/Excel
- Editable fields should use appropriate controls to constrain the data type
	- Numeric fields should only allow appropriately scoped numeric entries, considering min/max values
	- Date fields should present a date picker

# Data Management
Where practical, prefer non-nullable data types. Use empty values instead of nulls.

- String - empty string
- Integer/numeric - 0
- Dates: 1/1/1970

Dates and times are recorded in UTC. Displayed dates and times are displayed in the user's browser time zone, or default to the core configuration time zone.

# Mobile

The web application should be desktop and mobile friendly for all user/admin functions, excepting that some reports may not work well on small screens.

Inputs should be appropriately annotated for their datatype to facilitate mobile keyboard layouts for that kind of field (email, numbers, dates, etc.)

# Accessibility
Adhere to WCAG specifications wherever possible, preferably WCAG 2.2.

# Security
Registration and login pages will present a challenge to users to verify they are human (e.g., reCAPTCHA or similar).

The site will implement explicit CRSF-token enforcement and CORS policy.

General input validation will be present, subject to accessibility requirements.

All API endpoints will required a logged in user (JWT) unless specifically exempted (e.g., dynamic content of public information for anonymous users).
