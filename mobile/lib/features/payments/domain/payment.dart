import '../../orders/domain/order.dart';

/// What the backend returns when an online payment is started.
class CheckoutSession {
  const CheckoutSession({
    required this.provider,
    required this.gatewayOrderId,
    required this.amountPaise,
    required this.orderId,
    required this.orderNumber,
    this.keyId,
  });

  final String provider; // 'razorpay' | 'mock'
  final String gatewayOrderId;
  final int amountPaise;
  final String orderId;
  final String orderNumber;
  final String? keyId;

  factory CheckoutSession.fromJson(Map<String, dynamic> j) => CheckoutSession(
        provider: j['provider'] as String,
        gatewayOrderId: j['gatewayOrderId'] as String,
        amountPaise: (j['amount'] as num).toInt(),
        orderId: j['orderId'] as String,
        orderNumber: j['orderNumber'] as String,
        keyId: j['keyId'] as String?,
      );
}

class PaymentOutcome {
  const PaymentOutcome.success({required this.paymentId, required this.signature}) : error = null, cancelled = false;
  const PaymentOutcome.failure(this.error, {this.cancelled = false}) : paymentId = null, signature = null;

  final String? paymentId;
  final String? signature;
  final String? error;
  final bool cancelled;
  bool get isSuccess => paymentId != null;
}

abstract class PaymentsRepository {
  Future<CheckoutSession> start(String orderId);
  Future<Order> confirm(CheckoutSession s, PaymentOutcome outcome);
  Future<Order> cancel(String orderId);
}
