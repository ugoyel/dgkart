import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/net_image.dart';
import '../../../core/widgets/responsive.dart';
import '../../auth/presentation/auth_controller.dart';
import '../domain/cart.dart';
import 'cart_controller.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    final cart = ref.watch(cartControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Shopping cart')),
      body: user == null
          ? EmptyState(
              icon: Icons.shopping_cart_outlined,
              title: 'Sign in to see your cart',
              action: FilledButton(onPressed: () => context.push('/login?from=/cart'), child: const Text('Sign in')),
            )
          : AsyncView(
              value: cart,
              onRetry: () => ref.invalidate(cartControllerProvider),
              data: (c) => c.isEmpty
                  ? EmptyState(
                      icon: Icons.shopping_cart_outlined,
                      title: "You don't have any items in your cart",
                      action: FilledButton(onPressed: () => context.go('/'), child: const Text('Start shopping')),
                    )
                  : RefreshIndicator(
                      onRefresh: () => ref.read(cartControllerProvider.notifier).reload(),
                      child: ContentWidth(
                        maxWidth: 900,
                        child: ListView(padding: const EdgeInsets.only(bottom: 24), children: [
                          for (final line in c.lines) _CartLineTile(line: line),
                          _Summary(cart: c),
                        ]),
                      ),
                    ),
            ),
    );
  }
}

class _CartLineTile extends ConsumerWidget {
  const _CartLineTile({required this.line});
  final CartLine line;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = line.product;
    final ctrl = ref.read(cartControllerProvider.notifier);
    Future<void> run(Future<void> Function() f) async {
      try {
        await f();
      } catch (e) {
        if (context.mounted) showSnack(context, e.toString());
      }
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: DkColors.divider), borderRadius: BorderRadius.circular(12)),
      child: Column(children: [
        InkWell(
          onTap: () => context.push('/product/${p.id}'),
          child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
            SizedBox(width: 96, height: 96, child: NetImage(p.thumbnailUrl)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(p.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 4),
                Text(p.condition.label, style: const TextStyle(color: DkColors.textMuted, fontSize: 13)),
                const SizedBox(height: 6),
                Text(formatPrice(p.price), style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w700)),
                Text(p.freeShipping ? 'Free delivery' : '+ delivery', style: const TextStyle(color: DkColors.textMuted, fontSize: 12)),
              ]),
            ),
          ]),
        ),
        const SizedBox(height: 8),
        Row(children: [
          const Text('Qty '),
          DropdownButton<int>(
            value: line.quantity,
            items: [for (var i = 1; i <= (p.stock.clamp(line.quantity, 10)); i++) DropdownMenuItem(value: i, child: Text('$i'))],
            onChanged: (v) => run(() => ctrl.setQuantity(p.id, v ?? line.quantity)),
          ),
          const Spacer(),
          TextButton(onPressed: () => run(() => ctrl.remove(p.id)), child: const Text('Remove')),
        ]),
      ]),
    );
  }
}

class _Summary extends StatelessWidget {
  const _Summary({required this.cart});
  final Cart cart;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(16),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          _row('Items (${cart.count})', formatPrice(cart.subtotal)),
          _row('Delivery', cart.shippingFee == 0 ? 'Free' : formatPrice(cart.shippingFee)),
          const Divider(height: 24),
          _row('Subtotal', formatPrice(cart.total), bold: true),
          const SizedBox(height: 16),
          FilledButton(onPressed: () => context.push('/checkout'), child: const Text('Go to checkout')),
        ]),
      );

  Widget _row(String k, String v, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [
          Expanded(child: Text(k, style: TextStyle(fontSize: bold ? 18 : 15, fontWeight: bold ? FontWeight.w700 : null))),
          Text(v, style: TextStyle(fontSize: bold ? 18 : 15, fontWeight: bold ? FontWeight.w700 : null)),
        ]),
      );
}
