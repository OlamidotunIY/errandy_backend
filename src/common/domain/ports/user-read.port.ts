export interface UserSnapshot {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
}

/**
 * Read-only query port owned by the User module (adapter lives there).
 */
export abstract class IUserReadPort {
  abstract findById(userId: string): Promise<UserSnapshot | null>;
}
