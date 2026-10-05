import '../../account/domain/address.dart';
import 'app_user.dart';

/// State carried between "send OTP" and "verify OTP".
class OtpChallenge {
  OtpChallenge({required this.phone, this.verificationId, this.webConfirmation, this.resendToken});
  final String phone; // E.164, e.g. +919910123503
  final String? verificationId; // Firebase (Android/iOS)
  final Object? webConfirmation; // Firebase (web) ConfirmationResult
  final int? resendToken;
}

/// Sends and checks the one-time password. Swap implementations to change SMS provider
/// (Firebase today; MSG91, Twilio, AWS SNS later) without touching the UI.
abstract class OtpProvider {
  Future<OtpChallenge> send(String phoneE164, {OtpChallenge? resendOf});

  /// Returns a proof the backend accepts: a Firebase ID token, or the raw code in dev mode.
  Future<OtpProof> verify(OtpChallenge challenge, String code);
}

class OtpProof {
  const OtpProof.firebase(this.value) : isFirebase = true;
  const OtpProof.devCode(this.value) : isFirebase = false;
  final String value;
  final bool isFirebase;
}

abstract class AuthRepository {
  Future<OtpChallenge> requestOtp(String phoneE164, {OtpChallenge? resendOf});
  Future<AppUser> verifyOtp(OtpChallenge challenge, String code);
  Future<AppUser?> restoreSession();
  Future<AppUser> updateProfile({String? name, String? email});
  Future<AppUser> saveAddresses(List<Address> addresses);
  Future<void> logout();
  Future<void> deleteAccount();
}
