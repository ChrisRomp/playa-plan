import { AdminUpdateUserDto } from './admin-update-user.dto';

/**
 * @deprecated Use UpdateProfileDto for user-editable fields or AdminUpdateUserDto for admin operations.
 * Retained for backward compatibility with existing imports.
 */
export class UpdateUserDto extends AdminUpdateUserDto {}