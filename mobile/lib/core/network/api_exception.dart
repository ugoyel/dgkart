import 'package:dio/dio.dart';

/// The single error type the presentation layer sees, whatever the transport.
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  bool get isUnauthorized => statusCode == 401;

  factory ApiException.from(Object error) {
    if (error is ApiException) return error;
    if (error is DioException) {
      final data = error.response?.data;
      String? msg;
      if (data is Map && data['message'] != null) {
        final m = data['message'];
        msg = m is List ? m.join('\n') : m.toString();
      }
      if (msg == null) {
        switch (error.type) {
          case DioExceptionType.connectionTimeout:
          case DioExceptionType.receiveTimeout:
          case DioExceptionType.sendTimeout:
            msg = 'The server is taking too long. Please try again.';
          case DioExceptionType.connectionError:
            msg = 'No internet connection or server unreachable.';
          default:
            msg = 'Something went wrong. Please try again.';
        }
      }
      return ApiException(msg, statusCode: error.response?.statusCode);
    }
    return ApiException(error.toString());
  }

  @override
  String toString() => message;
}
