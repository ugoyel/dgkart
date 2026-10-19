import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../orders/domain/order.dart';
import '../data/payments_repository_impl.dart';
import 'payment_sheets.dart';

/// Runs the online payment for an order and returns the updated order.
/// On cancel/failure the order stays "Awaiting payment" so the user can retry.
Future<(Order?, String?)> payForOrder(BuildContext context, WidgetRef ref, Order order) async {
  final repo = ref.read(paymentsRepositoryProvider);
  final user = ref.read(currentUserProvider);
  final session = await repo.start(order.id);
  if (!context.mounted) return (null, null);
  final outcome = await collectPayment(context, session, contact: user?.phone ?? '', email: user?.email);
  if (!outcome.isSuccess) return (null, outcome.error);
  return (await repo.confirm(session, outcome), null);
}
