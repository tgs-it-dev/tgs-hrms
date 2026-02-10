import { registerDecorator } from 'class-validator';
import type { ValidationArguments, ValidationOptions } from 'class-validator';

export function Match<T extends object>(
  property: keyof T,
  validationOptions?: ValidationOptions,
) {
  return (object: T, propertyName: string) => {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [property],
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const relatedPropertyName = args.constraints[0] as
            | keyof T
            | undefined;

          if (!relatedPropertyName) {
            return false;
          }

          const relatedValue = (args.object as T)[relatedPropertyName];

          return value === relatedValue;
        },
      },
    });
  };
}
