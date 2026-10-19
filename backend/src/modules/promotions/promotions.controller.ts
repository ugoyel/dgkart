import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiTags, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsNumber, IsObject, IsOptional, IsString, IsUUID,
  Length, Matches, Max, Min, ValidateNested,
} from 'class-validator';
import { AuthUser, CurrentUser, Public, Role, Roles } from '../../common/roles';
import { Festival, OFFER_KINDS, OfferKind } from './engine';
import { PromotionsService } from './promotions.service';

class DiscountDto {
  @ApiProperty({ enum: ['PERCENT', 'FLAT'] }) @IsIn(['PERCENT', 'FLAT']) type!: 'PERCENT' | 'FLAT';
  @ApiProperty() @IsNumber() @Min(0) value!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) maxDiscount?: number;
}

class ScopeDto {
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(500) @IsUUID('all', { each: true }) productIds?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @ArrayMaxSize(200) @IsUUID('all', { each: true }) categoryIds?: string[];
}

class OfferDto {
  @ApiProperty({ enum: OFFER_KINDS }) @IsIn(OFFER_KINDS) kind!: OfferKind;
  @ApiProperty() @IsString() @Length(1, 200) title!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() description?: string;
  @ApiProperty({ type: DiscountDto }) @ValidateNested() @Type(() => DiscountDto) discount!: DiscountDto;
  @ApiProperty({ type: ScopeDto }) @ValidateNested() @Type(() => ScopeDto) scope!: ScopeDto;
  @ApiProperty() @IsDateString() startsAt!: string;
  @ApiProperty() @IsDateString() endsAt!: string;
  @ApiProperty() @IsBoolean() isActive!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) stockLimit?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) perUserLimit?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 20) code?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() clip?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) minOrder?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 80) bank?: string | null;
  @ApiPropertyOptional({ enum: ['CREDIT', 'DEBIT', 'ANY'] }) @IsOptional() @IsIn(['CREDIT', 'DEBIT', 'ANY']) cardType?: 'CREDIT' | 'DEBIT' | 'ANY';
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 40) festivalId?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 600) bannerImage?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}

class UpdateOfferDto extends PartialType(OfferDto) {}

class QuoteLineDto {
  @ApiProperty() @IsUUID() productId!: string;
  @ApiProperty() @IsInt() @Min(1) @Max(99) quantity!: number;
}

export class PaymentChoiceDto {
  @ApiProperty({ enum: ['ONLINE', 'COD'] }) @IsIn(['ONLINE', 'COD']) method!: 'ONLINE' | 'COD';
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 80) bank?: string;
  @ApiPropertyOptional({ enum: ['CREDIT', 'DEBIT', 'ANY'] }) @IsOptional() @IsIn(['CREDIT', 'DEBIT', 'ANY']) cardType?: 'CREDIT' | 'DEBIT' | 'ANY';
}

class QuoteDto {
  @ApiProperty({ type: [QuoteLineDto] }) @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => QuoteLineDto) items!: QuoteLineDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(0, 30) couponCode?: string;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsUUID('all', { each: true }) clippedCouponIds?: string[];
  @ApiPropertyOptional({ type: PaymentChoiceDto }) @IsOptional() @ValidateNested() @Type(() => PaymentChoiceDto) payment?: PaymentChoiceDto;
}

class FestivalDto {
  @ApiProperty() @Matches(/^[a-z0-9-]{2,40}$/) id!: string;
  @ApiProperty() @IsString() @Length(1, 80) name!: string;
  @ApiProperty() @IsString() @Length(0, 120) greeting!: string;
  @ApiProperty() @IsString() @Length(0, 200) tagline!: string;
  @ApiProperty({ example: { '2026': { start: '2026-11-06', end: '2026-11-11' } } }) @IsObject() dates!: Festival['dates'];
  @ApiProperty() @IsInt() @Min(0) @Max(1000) priority!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(60) themeLeadDays!: number;
  @ApiProperty() @IsInt() @Min(0) @Max(30) themeTrailDays!: number;
  @ApiProperty({ type: [Number] }) @IsArray() @IsInt({ each: true }) reminderWeeks!: number[];
  @ApiProperty() @IsObject() theme!: Festival['theme'];
  @ApiProperty() @IsObject() offerTemplate!: Festival['offerTemplate'];
  @ApiProperty() @IsBoolean() enabled!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() approximate?: boolean;
}

class PreviewQuery {
  @ApiPropertyOptional({ description: 'Preview the theme at this time (ISO date)' }) @IsOptional() @IsDateString() at?: string;
}

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  /** Theme, festival calendar and live / upcoming offers. */
  @Public() @Get()
  state(@Query() q: PreviewQuery) {
    return this.promotions.publicState(q.at ? new Date(q.at) : undefined);
  }

  /** Price a basket with deals, coupon and bank offer. Uses the shopper's history when signed in. */
  @Public() @Post('quote') @HttpCode(200)
  async quote(@CurrentUser() u: AuthUser | undefined, @Body() dto: QuoteDto) {
    return (await this.promotions.quote(u?.id ?? null, dto)).quote;
  }
}

@ApiTags('admin')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminPromotionsController {
  constructor(private readonly promotions: PromotionsService) {}

  @Get('offers') all() {
    return this.promotions.all();
  }

  @Post('offers') create(@Body() dto: OfferDto) {
    return this.promotions.create(dto);
  }

  @Patch('offers/:id') update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateOfferDto) {
    return this.promotions.update(id, dto);
  }

  @Delete('offers/:id') remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.promotions.remove(id);
  }

  @Get('festivals') festivals() {
    return this.promotions.calendar();
  }

  @Put('festivals/:id') saveFestival(@Param('id') id: string, @Body() dto: FestivalDto) {
    return this.promotions.saveFestival({ ...dto, id });
  }

  @Delete('festivals/:id') deleteFestival(@Param('id') id: string) {
    return this.promotions.deleteFestival(id);
  }

  @Post('festivals/reset') @HttpCode(200) resetFestivals() {
    return this.promotions.resetCalendar();
  }

  /** Create prepared (inactive) offers for a festival's next dates. */
  @Post('festivals/:id/drafts') createDrafts(@Param('id') id: string, @Query('year') year?: string) {
    return this.promotions.createDrafts(id, year);
  }

  /** Festival reminders that are due now. */
  @Get('notifications') notifications() {
    return this.promotions.reminders();
  }

  @Post('notifications/:id/dismiss') @HttpCode(200) dismiss(@Param('id') id: string) {
    return this.promotions.dismissReminder(id);
  }
}
