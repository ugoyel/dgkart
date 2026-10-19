import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';

import '../../../core/network/api_client.dart';
import '../../../core/network/api_exception.dart';
import '../domain/auth_repository.dart';

/// Real SMS OTP via Firebase Phone Auth (free tier: 10k verifications/month).
class FirebaseOtpProvider implements OtpProvider {
  FirebaseOtpProvider([FirebaseAuth? auth]) : _auth = auth ?? FirebaseAuth.instance;
  final FirebaseAuth _auth;

  @override
  Future<OtpChallenge> send(String phone, {OtpChallenge? resendOf}) async {
    if (kIsWeb) {
      final confirmation = await _auth.signInWithPhoneNumber(phone);
      return OtpChallenge(phone: phone, webConfirmation: confirmation);
    }
    final done = Completer<OtpChallenge>();
    await _auth.verifyPhoneNumber(
      phoneNumber: phone,
      forceResendingToken: resendOf?.resendToken,
      timeout: const Duration(seconds: 60),
      verificationCompleted: (_) {}, // user still types the code; SMS autofill fills it on Android
      verificationFailed: (e) {
        if (!done.isCompleted) done.completeError(ApiException(_friendly(e)));
      },
      codeSent: (id, token) {
        if (!done.isCompleted) done.complete(OtpChallenge(phone: phone, verificationId: id, resendToken: token));
      },
      codeAutoRetrievalTimeout: (_) {},
    );
    return done.future;
  }

  @override
  Future<OtpProof> verify(OtpChallenge c, String code) async {
    try {
      final UserCredential cred;
      if (c.webConfirmation != null) {
        cred = await (c.webConfirmation as ConfirmationResult).confirm(code);
      } else {
        cred = await _auth.signInWithCredential(
          PhoneAuthProvider.credential(verificationId: c.verificationId!, smsCode: code),
        );
      }
      final token = await cred.user!.getIdToken(true);
      return OtpProof.firebase(token!);
    } on FirebaseAuthException catch (e) {
      throw ApiException(_friendly(e));
    }
  }

  String _friendly(FirebaseAuthException e) => switch (e.code) {
        'invalid-verification-code' => 'Incorrect OTP. Please check and try again.',
        'session-expired' || 'code-expired' => 'OTP expired. Tap resend to get a new one.',
        'too-many-requests' => 'Too many attempts. Please try again later.',
        'invalid-phone-number' => 'That mobile number is not valid.',
        _ => e.message ?? 'Verification failed',
      };
}

/// Development OTP: the backend accepts a fixed test code (AUTH_MODE=dev). No SMS is sent.
class DevOtpProvider implements OtpProvider {
  DevOtpProvider(this._api);
  final ApiClient _api;

  @override
  Future<OtpChallenge> send(String phone, {OtpChallenge? resendOf}) async {
    await _api.post<dynamic>('/auth/otp/request', body: {'phone': phone});
    return OtpChallenge(phone: phone);
  }

  @override
  Future<OtpProof> verify(OtpChallenge c, String code) async => OtpProof.devCode(code);
}
