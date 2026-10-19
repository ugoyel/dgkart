import { Body, Controller, Delete, Get, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEmail, IsOptional, IsString, Length, Matches, ValidateNested } from 'class-validator';
import { AuthUser, CurrentUser } from '../../common/roles';
import { UsersService } from './users.service';

class UpdateProfileDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 120) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
}

export class AddressDto {
  @ApiProperty() @IsString() id!: string;
  @ApiProperty() @IsString() @Length(1, 120) name!: string;
  @ApiProperty() @IsString() @Length(10, 15) phone!: string;
  @ApiProperty() @IsString() @Length(1, 200) line1!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() line2?: string;
  @ApiProperty() @IsString() city!: string;
  @ApiProperty() @IsString() state!: string;
  @ApiProperty() @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' }) pincode!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isDefault?: boolean;
}

class AddressesDto {
  @ApiProperty({ type: [AddressDto] }) @IsArray() @ValidateNested({ each: true }) @Type(() => AddressDto)
  addresses!: AddressDto[];
}

@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get() me(@CurrentUser() u: AuthUser) {
    return this.users.get(u.id);
  }

  @Patch() update(@CurrentUser() u: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(u.id, dto);
  }

  @Delete() remove(@CurrentUser() u: AuthUser) {
    return this.users.deleteAccount(u.id);
  }

  @Put('addresses') addresses(@CurrentUser() u: AuthUser, @Body() dto: AddressesDto) {
    return this.users.setAddresses(u.id, dto.addresses);
  }
}
