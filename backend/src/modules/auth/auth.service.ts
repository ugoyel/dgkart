import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { normalizePhone } from '../../config/configuration';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { FirebaseTokenVerifier } from './firebase-token.verifier';

export interface Session {
  accessToken: string;
  user: User;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly firebase: FirebaseTokenVerifier,
  ) {}

  get mode(): 'firebase' | 'dev' {
    return this.config.get('authMode')!;
  }

  /** Production path: the app verified the OTP with Firebase and sends us its ID token. */
  async loginWithFirebase(idToken: string): Promise<Session> {
    if (this.mode !== 'firebase') throw new BadRequestException('Firebase login is disabled (AUTH_MODE=dev)');
    const phone = await this.firebase.verifyPhoneToken(idToken);
    return this.issue(await this.users.upsertByPhone(phone));
  }

  /** Development path: no SMS is sent; the OTP is always DEV_OTP_CODE. Disabled when AUTH_MODE=firebase. */
  requestDevOtp(phone: string): { sent: boolean; hint: string } {
    this.assertDev();
    if (normalizePhone(phone).length < 12) throw new BadRequestException('Enter a valid 10 digit mobile number');
    return { sent: true, hint: 'Development mode: use the configured test OTP' };
  }

  async verifyDevOtp(phone: string, code: string): Promise<Session> {
    this.assertDev();
    if (code !== this.config.get<string>('devOtpCode')) throw new UnauthorizedException('Incorrect OTP');
    return this.issue(await this.users.upsertByPhone(phone));
  }

  private assertDev() {
    if (this.mode !== 'dev') throw new BadRequestException('OTP is handled by Firebase on the client (AUTH_MODE=firebase)');
  }

  private issue(user: User): Session {
    const accessToken = this.jwt.sign({ sub: user.id, phone: user.phone, role: user.role });
    return { accessToken, user };
  }
}
