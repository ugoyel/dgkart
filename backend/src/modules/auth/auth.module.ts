import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FirebaseTokenVerifier } from './firebase-token.verifier';

@Module({
  imports: [UsersModule],
  providers: [AuthService, FirebaseTokenVerifier],
  controllers: [AuthController],
})
export class AuthModule {}
