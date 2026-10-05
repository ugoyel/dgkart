import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../storage/token_store.dart';
import 'api_exception.dart';

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient(ref.watch(tokenStoreProvider)));

/// Thin HTTP wrapper. Every repository talks to the backend through this, so
/// replacing REST with GraphQL/gRPC or another host is a change in one place.
class ApiClient {
  ApiClient(this._tokens, {Dio? dio})
      : dio = dio ??
            Dio(BaseOptions(
              baseUrl: AppConfig.apiRoot,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 60),
            )) {
    this.dio.interceptors.add(InterceptorsWrapper(onRequest: (options, handler) async {
      final token = await _tokens.read();
      if (token != null) options.headers['Authorization'] = 'Bearer $token';
      handler.next(options);
    }));
  }

  final Dio dio;
  final TokenStore _tokens;

  /// Called by the auth layer when the server says the session is invalid.
  void Function()? onUnauthorized;

  Future<T> _wrap<T>(Future<Response<dynamic>> Function() call) async {
    try {
      final res = await call();
      return res.data as T;
    } catch (e) {
      final ex = ApiException.from(e);
      if (ex.isUnauthorized) onUnauthorized?.call();
      throw ex;
    }
  }

  Future<T> get<T>(String path, {Map<String, dynamic>? query}) =>
      _wrap(() => dio.get(path, queryParameters: query?..removeWhere((_, v) => v == null)));

  Future<T> post<T>(String path, {Object? body}) => _wrap(() => dio.post(path, data: body));

  Future<T> put<T>(String path, {Object? body}) => _wrap(() => dio.put(path, data: body));

  Future<T> patch<T>(String path, {Object? body}) => _wrap(() => dio.patch(path, data: body));

  Future<T> delete<T>(String path) => _wrap(() => dio.delete(path));

  Future<T> upload<T>(String path, FormData form, {void Function(int sent, int total)? onProgress}) =>
      _wrap(() => dio.post(path, data: form, onSendProgress: onProgress));
}
