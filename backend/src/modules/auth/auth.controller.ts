import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsString, Length, Matches } from 'class-validator';
import { Public } from '../../common/roles';
import { AuthService } from './auth.service';

class FirebaseLoginDto {
  @ApiProperty() @IsString() @Length(20, 5000) idToken!: string;
}

class OtpRequestDto {
  @ApiProperty({ example: '9910123503' }) @Matches(/^(\+?91)?[6-9]\d{9}$/, { message: 'Enter a valid Indian mobile number' })
  phone!: string;
}

class OtpVerifyDto extends OtpRequestDto {
  @ApiProperty({ example: '123456' }) @IsString() @Length(4, 8) code!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public() @Get('config')
  config() {
    return { mode: this.auth.mode };
  }

  @Public() @Post('firebase') @HttpCode(200)
  firebase(@Body() dto: FirebaseLoginDto) {
    return this.auth.loginWithFirebase(dto.idToken);
  }

  @Public() @Throttle({ default: { limit: 5, ttl: 60_000 } }) @Post('otp/request') @HttpCode(200)
  requestOtp(@Body() dto: OtpRequestDto) {
    return this.auth.requestDevOtp(dto.phone);
  }

  @Public() @Throttle({ default: { limit: 10, ttl: 60_000 } }) @Post('otp/verify') @HttpCode(200)
  verifyOtp(@Body() dto: OtpVerifyDto) {
    return this.auth.verifyDevOtp(dto.phone, dto.code);
  }
}
