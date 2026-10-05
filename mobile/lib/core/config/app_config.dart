/// Build-time configuration passed with --dart-define, so the same code runs
/// against local, staging and production backends without edits.
///
///   flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
///   flutter build appbundle --dart-define=API_BASE_URL=https://api.dgkart.com --dart-define=AUTH_MODE=firebase
class AppConfig {
  AppConfig._();

  static const String apiBaseUrl = String.fromEnvironment('API_BASE_URL', defaultValue: 'http://10.0.2.2:3000');

  /// `firebase` = real SMS OTP through Firebase Phone Auth.
  /// `dev` = backend test OTP (no SMS), for local development only.
  static const String authMode = String.fromEnvironment('AUTH_MODE', defaultValue: 'dev');

  static const String appName = 'DGkart';
  static const String brandName = 'DKKart';
  static const String supportEmail = String.fromEnvironment('SUPPORT_EMAIL', defaultValue: 'support@dgkart.com');
  static const String privacyPolicyUrl =
      String.fromEnvironment('PRIVACY_POLICY_URL', defaultValue: 'https://dgkart.com/privacy');

  static String get apiRoot => '$apiBaseUrl/api/v1';
  static bool get useFirebase => authMode == 'firebase';
}
