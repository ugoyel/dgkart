import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the API session token in the platform keystore.
class TokenStore {
  TokenStore([FlutterSecureStorage? storage]) : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _key = 'dk_access_token';
  String? _cached;

  Future<String?> read() async => _cached ??= await _storage.read(key: _key);

  Future<void> write(String token) async {
    _cached = token;
    await _storage.write(key: _key, value: token);
  }

  Future<void> clear() async {
    _cached = null;
    await _storage.delete(key: _key);
  }
}
