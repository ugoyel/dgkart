import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:razorpay_flutter/razorpay_flutter.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../domain/payment.dart';

/// Opens the right payment UI for the provider the backend chose.
/// Adding Stripe/PayU/PhonePe = one more branch here plus a backend gateway.
Future<PaymentOutcome> collectPayment(
  BuildContext context,
  CheckoutSession session, {
  required String contact,
  String? email,
}) {
  switch (session.provider) {
    case 'razorpay':
      if (kIsWeb) {
        return Future.value(const PaymentOutcome.failure('Online payment on web will use Razorpay Checkout.js (website phase).'));
      }
      return _RazorpaySheet(session, contact: contact, email: email).open();
    default:
      return _mockPayment(context, session);
  }
}

class _RazorpaySheet {
  _RazorpaySheet(this.session, {required this.contact, this.email});
  final CheckoutSession session;
  final String contact;
  final String? email;

  Future<PaymentOutcome> open() {
    final razorpay = Razorpay();
    final done = Completer<PaymentOutcome>();
    void finish(PaymentOutcome o) {
      if (!done.isCompleted) done.complete(o);
      razorpay.clear();
    }

    razorpay.on(Razorpay.EVENT_PAYMENT_SUCCESS, (PaymentSuccessResponse r) {
      finish(PaymentOutcome.success(paymentId: r.paymentId ?? '', signature: r.signature ?? ''));
    });
    razorpay.on(Razorpay.EVENT_PAYMENT_ERROR, (PaymentFailureResponse r) {
      finish(PaymentOutcome.failure(r.message ?? 'Payment failed', cancelled: r.code == Razorpay.PAYMENT_CANCELLED));
    });
    razorpay.on(Razorpay.EVENT_EXTERNAL_WALLET, (ExternalWalletResponse r) {
      finish(PaymentOutcome.failure('Selected ${r.walletName}; complete payment in the wallet app.'));
    });
    razorpay.open({
      'key': session.keyId,
      'order_id': session.gatewayOrderId,
      'amount': session.amountPaise,
      'currency': 'INR',
      'name': 'DGkart',
      'description': 'Order ${session.orderNumber}',
      'prefill': {'contact': contact, if (email != null) 'email': email},
      'theme': {'color': '#1A56DB'},
      'retry': {'enabled': true, 'max_count': 2},
    });
    return done.future;
  }
}

/// Test-mode payment sheet used when the backend runs PAYMENT_PROVIDER=mock.
Future<PaymentOutcome> _mockPayment(BuildContext context, CheckoutSession s) async {
  final ok = await showModalBottomSheet<bool>(
    context: context,
    isDismissible: false,
    builder: (_) => SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          const Row(children: [
            Icon(Icons.science_outlined, color: DkColors.accent),
            SizedBox(width: 8),
            Text('Test payment', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 8),
          Text('No money will be charged. Amount: ${formatPrice(s.amountPaise / 100)}',
              style: const TextStyle(color: DkColors.textMuted)),
          const SizedBox(height: 20),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Simulate success')),
          const SizedBox(height: 10),
          OutlinedButton(onPressed: () => Navigator.pop(context, false), child: const Text('Simulate failure')),
        ]),
      ),
    ),
  );
  return ok == true
      ? PaymentOutcome.success(paymentId: 'pay_mock_${DateTime.now().millisecondsSinceEpoch}', signature: 'mock-success')
      : const PaymentOutcome.failure('Payment was not completed', cancelled: true);
}
