import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../account/domain/address.dart';
import '../data/auth_repository_impl.dart';
import '../domain/app_user.dart';
import '../domain/auth_repository.dart';

final authControllerProvider = AsyncNotifierProvider<AuthController, AppUser?>(AuthController.new);

/// Signed-in user, or null for guests. Guests can browse; cart, watchlist and checkout need login.
class AuthController extends AsyncNotifier<AppUser?> {
  AuthRepository get _repo => ref.read(authRepositoryProvider);

  @override
  Future<AppUser?> build() async {
    ref.read(apiClientProvider).onUnauthorized = () {
      if (state.value != null) logout();
    };
    return _repo.restoreSession();
  }

  Future<OtpChallenge> requestOtp(String tenDigitMobile, {OtpChallenge? resendOf}) =>
      _repo.requestOtp('+91$tenDigitMobile', resendOf: resendOf);

  Future<AppUser> verify(OtpChallenge challenge, String code) async {
    final user = await _repo.verifyOtp(challenge, code);
    state = AsyncData(user);
    return user;
  }

  Future<void> updateProfile({String? name, String? email}) async {
    state = AsyncData(await _repo.updateProfile(name: name, email: email));
  }

  Future<void> saveAddresses(List<Address> addresses) async {
    state = AsyncData(await _repo.saveAddresses(addresses));
  }

  Future<void> deleteAccount() async {
    await _repo.deleteAccount();
    state = const AsyncData(null);
  }

  Future<void> logout() async {
    await _repo.logout();
    state = const AsyncData(null);
  }
}

/// Convenience: current user or null without dealing with AsyncValue.
final currentUserProvider = Provider<AppUser?>((ref) => ref.watch(authControllerProvider).value);
