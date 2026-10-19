import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../../common/roles';
import { normalizePhone } from '../../config/configuration';
import { Address, User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly repo: Repository<User>, private readonly config: ConfigService) {}

  /** Role is derived from the phone number on every login, so changing ADMIN_PHONE takes effect immediately. */
  roleFor(phone: string): Role {
    return normalizePhone(phone) === this.config.get<string>('adminPhone') ? Role.ADMIN : Role.USER;
  }

  async upsertByPhone(rawPhone: string): Promise<User> {
    const phone = normalizePhone(rawPhone);
    const role = this.roleFor(phone);
    let user = await this.repo.findOne({ where: { phone } });
    if (!user) {
      user = this.repo.create({ phone, role, addresses: [] });
    } else {
      user.role = role;
    }
    return this.repo.save(user);
  }

  async get(id: string): Promise<User> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateProfile(id: string, patch: { name?: string; email?: string }): Promise<User> {
    const user = await this.get(id);
    if (patch.name !== undefined) user.name = patch.name;
    if (patch.email !== undefined) user.email = patch.email;
    return this.repo.save(user);
  }

  async setAddresses(id: string, addresses: Address[]): Promise<User> {
    const user = await this.get(id);
    user.addresses = addresses;
    return this.repo.save(user);
  }

  /**
   * Play Store requires in-app account deletion. Removes the profile, cart and watchlist.
   * Orders are kept (tax/accounting law) but no longer linked to a profile.
   */
  async deleteAccount(id: string): Promise<{ deleted: boolean }> {
    await this.repo.manager.transaction(async (tx) => {
      await tx.query('DELETE FROM cart_items WHERE "userId" = $1', [id]);
      await tx.query('DELETE FROM watchlist WHERE "userId" = $1', [id]);
      await tx.delete(User, { id });
    });
    return { deleted: true };
  }

  count(): Promise<number> {
    return this.repo.count();
  }
}
