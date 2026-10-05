/**
 * Central, typed configuration. Every environment variable the API reads is
 * listed here, so moving to another runtime only means re-mapping this file.
 */
export interface AppConfig {
  port: number;
  nodeEnv: string;
  publicBaseUrl: string;
  corsOrigins: string[] | '*';
  databaseUrl: string;
  dbSync: boolean;
  jwtSecret: string;
  jwtExpiresIn: string;
  adminPhone: string;
  authMode: 'firebase' | 'dev';
  devOtpCode: string;
  firebaseProjectId?: string;
  firebaseServiceAccountJson?: string;
  paymentProvider: 'razorpay' | 'mock';
  razorpayKeyId?: string;
  razorpayKeySecret?: string;
  razorpayWebhookSecret?: string;
  uploadDir: string;
  importBatchSize: number;
  seedOnBoot: number;
}

export function normalizePhone(raw: string): string {
  const digits = (raw || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  const only = digits.replace(/\D/g, '');
  if (only.length === 10) return `+91${only}`;
  if (only.length === 12 && only.startsWith('91')) return `+${only}`;
  return `+${only}`;
}

export default (): AppConfig => {
  const env = process.env;
  const cors = env.CORS_ORIGINS ?? '*';
  return {
    port: parseInt(env.PORT ?? '3000', 10),
    nodeEnv: env.NODE_ENV ?? 'development',
    publicBaseUrl: (env.PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
    corsOrigins: cors === '*' ? '*' : cors.split(',').map((s) => s.trim()),
    databaseUrl: env.DATABASE_URL ?? 'postgres://dgkart:dgkart@localhost:5432/dgkart',
    dbSync: (env.DB_SYNC ?? 'true') === 'true',
    jwtSecret: env.JWT_SECRET ?? 'dev-secret-change-me',
    jwtExpiresIn: env.JWT_EXPIRES_IN ?? '30d',
    adminPhone: normalizePhone(env.ADMIN_PHONE ?? '+919910123503'),
    authMode: env.AUTH_MODE === 'firebase' ? 'firebase' : 'dev',
    devOtpCode: env.DEV_OTP_CODE ?? '123456',
    firebaseProjectId: env.FIREBASE_PROJECT_ID || undefined,
    firebaseServiceAccountJson: env.FIREBASE_SERVICE_ACCOUNT_JSON || undefined,
    paymentProvider: env.PAYMENT_PROVIDER === 'razorpay' ? 'razorpay' : 'mock',
    razorpayKeyId: env.RAZORPAY_KEY_ID || undefined,
    razorpayKeySecret: env.RAZORPAY_KEY_SECRET || undefined,
    razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET || undefined,
    uploadDir: env.UPLOAD_DIR ?? './uploads',
    importBatchSize: parseInt(env.IMPORT_BATCH_SIZE ?? '500', 10),
    seedOnBoot: parseInt(env.SEED_ON_BOOT ?? '0', 10),
  };
};
