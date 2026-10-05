import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/token_store.dart';
import '../../account/domain/address.dart';
import '../domain/app_user.dart';
import '../domain/auth_repository.dart';
import 'otp_providers.dart';

final otpProviderProvider = Provider<OtpProvider>(
  (ref) => AppConfig.useFirebase ? FirebaseOtpProvider() : DevOtpProvider(ref.watch(apiClientProvider)),
);

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => RestAuthRepository(ref.watch(apiClientProvider), ref.watch(tokenStoreProvider), ref.watch(otpProviderProvider)),
);

class RestAuthRepository implements AuthRepository {
  RestAuthRepository(this._api, this._tokens, this._otp);
  final ApiClient _api;
  final TokenStore _tokens;
  final OtpProvider _otp;

  @override
  Future<OtpChallenge> requestOtp(String phone, {OtpChallenge? resendOf}) => _otp.send(phone, resendOf: resendOf);

  @override
  Future<AppUser> verifyOtp(OtpChallenge challenge, String code) async {
    final proof = await _otp.verify(challenge, code);
    final session = proof.isFirebase
        ? await _api.post<Map<String, dynamic>>('/auth/firebase', body: {'idToken': proof.value})
        : await _api.post<Map<String, dynamic>>('/auth/otp/verify', body: {'phone': challenge.phone, 'code': proof.value});
    await _tokens.write(session['accessToken'] as String);
    return AppUser.fromJson(session['user'] as Map<String, dynamic>);
  }

  @override
  Future<AppUser?> restoreSession() async {
    if (await _tokens.read() == null) return null;
    try {
      return AppUser.fromJson(await _api.get<Map<String, dynamic>>('/users/me'));
    } catch (_) {
      await _tokens.clear();
      return null;
    }
  }

  @override
  Future<AppUser> updateProfile({String? name, String? email}) async => AppUser.fromJson(
        await _api.patch<Map<String, dynamic>>('/users/me', body: {
          'name': ?name,
          if (email != null && email.isNotEmpty) 'email': email,
        }),
      );

  @override
  Future<AppUser> saveAddresses(List<Address> addresses) async => AppUser.fromJson(
        await _api.put<Map<String, dynamic>>('/users/me/addresses',
            body: {'addresses': addresses.map((a) => a.toJson()).toList()}),
      );

  @override
  Future<void> deleteAccount() async {
    await _api.delete<dynamic>('/users/me');
    await logout();
  }

  @override
  Future<void> logout() async {
    await _tokens.clear();
    if (AppConfig.useFirebase) await FirebaseAuth.instance.signOut();
  }
}
