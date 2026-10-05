import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../orders/domain/order.dart';
import '../domain/payment.dart';

final paymentsRepositoryProvider = Provider<PaymentsRepository>((ref) => RestPaymentsRepository(ref.watch(apiClientProvider)));

class RestPaymentsRepository implements PaymentsRepository {
  RestPaymentsRepository(this._api);
  final ApiClient _api;

  @override
  Future<CheckoutSession> start(String orderId) async =>
      CheckoutSession.fromJson(await _api.post<Map<String, dynamic>>('/payments/checkout', body: {'orderId': orderId}));

  @override
  Future<Order> confirm(CheckoutSession s, PaymentOutcome o) async =>
      Order.fromJson(await _api.post<Map<String, dynamic>>('/payments/confirm', body: {
        'orderId': s.orderId,
        'gatewayOrderId': s.gatewayOrderId,
        'paymentId': o.paymentId,
        'signature': o.signature,
      }));

  @override
  Future<Order> cancel(String orderId) async =>
      Order.fromJson(await _api.post<Map<String, dynamic>>('/payments/fail', body: {'orderId': orderId}));
}
