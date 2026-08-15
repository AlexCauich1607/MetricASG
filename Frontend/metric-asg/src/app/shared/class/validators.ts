import { AbstractControl, ValidationErrors } from '@angular/forms';

export function phoneValidate(name: string): boolean {
  const regex = /^\+?[0-9]{10,15}$/;
  return regex.test(name)
    ? true
    : false;
}