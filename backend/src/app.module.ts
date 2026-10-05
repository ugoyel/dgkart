import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { resolve } from 'path';
import { AppController } from './app.controller';
import { AuthGuard } from './common/auth.guard';
import configuration from './config/configuration';
import { BootstrapService } from './database/bootstrap.service';
import { ENTITIES } from './database/entities';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { CartModule } from './modules/cart/cart.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { StorageModule } from './modules/storage/storage.module';
import { UsersModule } from './modules/users/users.module';
import { WatchlistModule } from './modules/watchlist/watchlist.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        type: 'postgres',
        url: c.get<string>('databaseUrl'),
        entities: ENTITIES,
        synchronize: c.get<boolean>('dbSync'),
        ssl: /sslmode=require|neon\.tech|supabase|render\.com/.test(c.get<string>('databaseUrl') ?? '') ? { rejectUnauthorized: false } : false,
        extra: { max: 20 },
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({ secret: c.get('jwtSecret'), signOptions: { expiresIn: c.get('jwtExpiresIn') } }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => [
        { rootPath: resolve(c.get<string>('uploadDir')!), serveRoot: '/uploads', serveStaticOptions: { maxAge: '30d', index: false } },
        // Public pages such as /privacy.html (the Play Store privacy policy URL).
        { rootPath: resolve(__dirname, '..', 'public'), serveRoot: '/', serveStaticOptions: { index: false } },
      ],
    }),
    StorageModule,
    UsersModule,
    AuthModule,
    CatalogModule,
    CartModule,
    WatchlistModule,
    OrdersModule,
    PaymentsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    BootstrapService,
  ],
})
export class AppModule {}
