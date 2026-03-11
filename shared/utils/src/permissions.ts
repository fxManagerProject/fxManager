import { UserPermissions } from '@fxmanager/types';

export class PermissionManager {
  constructor() {}

  static has(userBitfield: number, required: UserPermissions): boolean {
    if (userBitfield & UserPermissions.MASTER) return true;

    return (userBitfield & required) === required;
  }

  static hasAll(userBitfield: number, required: UserPermissions[]): boolean {
    if (userBitfield & UserPermissions.MASTER) return true;

    const combined = required.reduce((acc, p) => acc | p, 0);

    return (userBitfield & combined) === combined;
  }

  static grant(userBitfield: number, toAdd: UserPermissions): number {
    return userBitfield | toAdd;
  }

  static revoke(userBitfield: number, toRemove: UserPermissions): number {
    return userBitfield & ~toRemove;
  }
}
