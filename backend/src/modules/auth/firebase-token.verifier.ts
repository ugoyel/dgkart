import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

/**
 * Verifies Firebase Phone Auth ID tokens produced by the mobile/web client.
 * Only FIREBASE_PROJECT_ID is required: token verification uses Google's public keys.
 */
@Injectable()
export class FirebaseTokenVerifier {
  private readonly log = new Logger(FirebaseTokenVerifier.name);
  private app?: App;

  constructor(private readonly config: ConfigService) {}

  private getApp(): App {
    if (this.app) return this.app;
    const existing = getApps()[0];
    if (existing) return (this.app = existing);
    const json = this.config.get<string>('firebaseServiceAccountJson');
    const projectId = this.config.get<string>('firebaseProjectId');
    this.app = json ? initializeApp({ credential: cert(JSON.parse(json)), projectId }) : initializeApp({ projectId });
    this.log.log(`Firebase admin initialised for project ${projectId ?? '(from credentials)'}`);
    return this.app;
  }

  async verifyPhoneToken(idToken: string): Promise<string> {
    try {
      const decoded = await getAuth(this.getApp()).verifyIdToken(idToken);
      if (!decoded.phone_number) throw new Error('token has no phone_number');
      return decoded.phone_number;
    } catch (e) {
      this.log.warn(`Firebase token rejected: ${(e as Error).message}`);
      throw new UnauthorizedException('Phone verification failed');
    }
  }
}
