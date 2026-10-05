import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/net_image.dart';
import '../../../core/widgets/responsive.dart';
import '../../payments/data/payments_repository_impl.dart';
import '../../payments/presentation/pay_for_order.dart';
import '../data/orders_repository_impl.dart';
import '../domain/order.dart';

Color statusColor(OrderStatus s) => switch (s) {
      OrderStatus.paid || OrderStatus.confirmedCod || OrderStatus.delivered => DkColors.success,
      OrderStatus.shipped => DkColors.primary,
      OrderStatus.pendingPayment => DkColors.accent,
      _ => DkColors.deal,
    };

class OrderSuccessScreen extends ConsumerWidget {
  const OrderSuccessScreen({super.key, required this.orderId});
  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final order = ref.watch(orderProvider(orderId));
    return Scaffold(
      body: SafeArea(
        child: AsyncView(
          value: order,
          data: (o) => Center(
            child: ContentWidth(
              maxWidth: 480,
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  const Icon(Icons.check_circle, color: DkColors.success, size: 88),
                  const SizedBox(height: 16),
                  const Text('Thank you, your order is placed!',
                      textAlign: TextAlign.center, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                  const SizedBox(height: 8),
                  Text('Order ${o.orderNumber} • ${formatPrice(o.total)}',
                      textAlign: TextAlign.center, style: const TextStyle(color: DkColors.textMuted)),
                  const SizedBox(height: 4),
                  Text(o.status.label, textAlign: TextAlign.center, style: TextStyle(color: statusColor(o.status))),
                  const SizedBox(height: 28),
                  FilledButton(onPressed: () => context.go('/account/orders/${o.id}'), child: const Text('View order details')),
                  const SizedBox(height: 10),
                  OutlinedButton(onPressed: () => context.go('/'), child: const Text('Continue shopping')),
                ]),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(myOrdersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Purchases')),
      body: AsyncView(
        value: orders,
        onRetry: () => ref.invalidate(myOrdersProvider),
        data: (list) => list.isEmpty
            ? const EmptyState(icon: Icons.receipt_long_outlined, title: 'No purchases yet')
            : RefreshIndicator(
                onRefresh: () => ref.refresh(myOrdersProvider.future),
                child: ContentWidth(
                  maxWidth: 900,
                  child: ListView.separated(
                    itemCount: list.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (_, i) => OrderTile(order: list[i], onTap: () => context.push('/account/orders/${list[i].id}')),
                  ),
                ),
              ),
      ),
    );
  }
}

class OrderTile extends StatelessWidget {
  const OrderTile({super.key, required this.order, this.onTap, this.trailing});
  final Order order;
  final VoidCallback? onTap;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final first = order.items.first;
    return ListTile(
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      leading: SizedBox(width: 64, height: 64, child: NetImage(first.imageUrl)),
      title: Text(
        order.items.length == 1 ? first.title : '${first.title} + ${order.items.length - 1} more',
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Text('${formatDate(order.createdAt)} • ${formatPrice(order.total)}\n${order.status.label}',
          style: TextStyle(color: statusColor(order.status))),
      isThreeLine: true,
      trailing: trailing ?? const Icon(Icons.chevron_right),
    );
  }
}

class OrderDetailScreen extends ConsumerStatefulWidget {
  const OrderDetailScreen({super.key, required this.orderId});
  final String orderId;

  @override
  ConsumerState<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends ConsumerState<OrderDetailScreen> {
  bool _busy = false;

  Future<void> _pay(Order o) async {
    setState(() => _busy = true);
    try {
      final (paid, error) = await payForOrder(context, ref, o);
      if (!mounted) return;
      if (paid != null) {
        ref.invalidate(orderProvider(o.id));
        context.go('/order-success/${o.id}');
      } else {
        showSnack(context, error ?? 'Payment not completed');
      }
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _cancel(Order o) async {
    setState(() => _busy = true);
    try {
      await ref.read(paymentsRepositoryProvider).cancel(o.id);
      ref.invalidate(orderProvider(o.id));
      ref.invalidate(myOrdersProvider);
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final order = ref.watch(orderProvider(widget.orderId));
    return Scaffold(
      appBar: AppBar(title: const Text('Order details')),
      body: AsyncView(
        value: order,
        onRetry: () => ref.invalidate(orderProvider(widget.orderId)),
        data: (o) => ContentWidth(
          maxWidth: 760,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            Text('Order ${o.orderNumber}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('Placed on ${formatDate(o.createdAt)}', style: const TextStyle(color: DkColors.textMuted)),
            const SizedBox(height: 8),
            Chip(
              label: Text(o.status.label, style: const TextStyle(color: Colors.white)),
              backgroundColor: statusColor(o.status),
            ),
            if (o.canPay) ...[
              const SizedBox(height: 8),
              FilledButton(onPressed: _busy ? null : () => _pay(o), child: Text('Pay ${formatPrice(o.total)} now')),
              TextButton(onPressed: _busy ? null : () => _cancel(o), child: const Text('Cancel order')),
            ],
            const Divider(height: 32),
            for (final l in o.items)
              ListTile(
                contentPadding: EdgeInsets.zero,
                onTap: () => context.push('/product/${l.productId}'),
                leading: SizedBox(width: 56, height: 56, child: NetImage(l.imageUrl)),
                title: Text(l.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                subtitle: Text('Qty ${l.quantity} × ${formatPrice(l.unitPrice)}'),
              ),
            const Divider(height: 32),
            const Text('Delivery address', style: TextStyle(fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            Text('${o.address.name}\n${o.address.singleLine}\n+91 ${o.address.phone}'),
            const Divider(height: 32),
            _row('Items', formatPrice(o.subtotal)),
            _row('Delivery', o.shippingFee == 0 ? 'Free' : formatPrice(o.shippingFee)),
            _row('Total', formatPrice(o.total), bold: true),
            _row('Payment', o.paymentMethod == PaymentMethod.cod ? 'Cash on Delivery' : 'Online'),
          ]),
        ),
      ),
    );
  }

  Widget _row(String k, String v, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Expanded(child: Text(k, style: TextStyle(fontWeight: bold ? FontWeight.w700 : null))),
          Text(v, style: TextStyle(fontWeight: bold ? FontWeight.w700 : null)),
        ]),
      );
}
