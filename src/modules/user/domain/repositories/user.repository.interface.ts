import { User } from '../';

export abstract class IUserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
}
