import { registerDecorator, ValidationOptions } from 'class-validator';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

/**
 * Validates that a value is a valid E.164 phone number.
 *
 * - Input must be a non-empty string starting with `+` followed by the country
 *   code and subscriber number (E.164 format, e.g. `+14155552671`).
 * - Validity is checked via `libphonenumber-js`'s `isPossible()` (permissive
 *   length/format check against the country numbering plan).
 * - Non-string / empty values return `false`; combine with `@IsString()` and
 *   `@IsNotEmpty()` (or `@IsOptional()`) to surface those errors separately.
 */
export function IsValidPhone(validationOptions?: ValidationOptions) {
  return (object: object, propertyName: string): void => {
    registerDecorator({
      name: 'isValidPhone',
      target: object.constructor,
      propertyName,
      options: {
        message: 'phone must be a valid E.164 phone number (e.g. +14155552671)',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string' || value.length === 0) {
            return false;
          }
          if (!value.startsWith('+')) {
            return false;
          }
          const parsed = parsePhoneNumberFromString(value);
          return parsed?.isPossible() === true;
        },
      },
    });
  };
}
