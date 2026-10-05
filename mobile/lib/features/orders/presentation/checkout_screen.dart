import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/net_image.dart';
import '../../../core/widgets/responsive.dart';
import '../../account/domain/address.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../cart/domain/cart.dart';
import '../../cart/presentation/cart_controller.dart';
import '../../catalog/domain/product.dart';
import '../../payments/presentation/pay_for_order.dart';
import '../data/orders_repository_impl.dart';
import '../domain/order.dart';

/// Review & pay: ship-to address, payment method, items, total, "Confirm and pay".
class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key, this.buyNow, this.quantity = 1});
  final Product? buyNow;
  final int quantity;

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  Address? _address;
  PaymentMethod _method = PaymentMethod.online;
  bool _busy = false;

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(currentUserProvider);
    _address ??= user?.defaultAddress;
    final cart = ref.watch(cartControllerProvider).value;
    final List<({Product product, int qty})> lines = widget.buyNow != null
        ? [(product: widget.buyNow!, qty: widget.quantity)]
        : [for (final l in cart?.lines ?? const <CartLine>[]) (product: l.product, qty: l.quantity)];
    final totals = Pricing.of([for (final l in lines) (price: l.product.price, qty: l.qty, freeShipping: l.product.freeShipping)]);

    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: lines.isEmpty
          ? const EmptyState(icon: Icons.shopping_cart_outlined, title: 'Nothing to check out')
          : ContentWidth(
              maxWidth: 760,
              child: ListView(padding: const EdgeInsets.all(16), children: [
                _section('Ship to', _addressCard()),
                _section(
                  'Pay with',
                  RadioGroup<PaymentMethod>(
                    groupValue: _method,
                    onChanged: (v) => setState(() => _method = v!),
                    child: const Column(children: [
                    RadioListTile<PaymentMethod>(
                      value: PaymentMethod.online,
                      title: Text('UPI, Cards, Net Banking, Wallets'),
                      subtitle: Text('Secure payment via Razorpay'),
                      secondary: Icon(Icons.account_balance_wallet_outlined),
                    ),
                    RadioListTile<PaymentMethod>(
                      value: PaymentMethod.cod,
                      title: Text('Cash on Delivery'),
                      secondary: Icon(Icons.payments_outlined),
                    ),
                  ]),
                  ),
                ),
                _section(
                  'Review items',
                  Column(children: [
                    for (final l in lines)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: SizedBox(width: 56, height: 56, child: NetImage(l.product.thumbnailUrl)),
                        title: Text(l.product.title, maxLines: 2, overflow: TextOverflow.ellipsis),
                        subtitle: Text('Qty ${l.qty}'),
                        trailing: Text(formatPrice(l.product.price * l.qty), style: const TextStyle(fontWeight: FontWeight.w700)),
                      ),
                  ]),
                ),
                _row('Items', formatPrice(totals.subtotal)),
                _row('Delivery', totals.shipping == 0 ? 'Free' : formatPrice(totals.shipping)),
                const Divider(height: 24),
                _row('Order total', formatPrice(totals.total), bold: true),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _busy || _address == null ? null : () => _placeOrder(lines),
                  child: _busy
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                      : Text(_method == PaymentMethod.cod ? 'Place order' : 'Confirm and pay'),
                ),
                const SizedBox(height: 8),
                const Text('By placing your order you agree to the DKKart terms and privacy notice.',
                    textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: DkColors.textMuted)),
              ]),
            ),
    );
  }

  Widget _addressCard() {
    final a = _address;
    if (a == null) {
      return OutlinedButton.icon(onPressed: _pickAddress, icon: const Icon(Icons.add), label: const Text('Add a delivery address'));
    }
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(a.name, style: const TextStyle(fontWeight: FontWeight.w600)),
      subtitle: Text('${a.singleLine}\n+91 ${a.phone}'),
      isThreeLine: true,
      trailing: TextButton(onPressed: _pickAddress, child: const Text('Change')),
    );
  }

  Future<void> _pickAddress() async {
    final user = ref.read(currentUserProvider)!;
    Address? picked;
    if (user.addresses.isEmpty) {
      picked = await context.push<Address>('/account/address');
    } else {
      picked = await showModalBottomSheet<Address>(
        context: context,
        builder: (sheet) => SafeArea(
          child: ListView(shrinkWrap: true, children: [
            for (final a in ref.read(currentUserProvider)!.addresses)
              ListTile(
                leading: Icon(a.id == _address?.id ? Icons.radio_button_checked : Icons.radio_button_off),
                title: Text(a.name),
                subtitle: Text(a.singleLine),
                onTap: () => Navigator.pop(sheet, a),
              ),
            ListTile(
              leading: const Icon(Icons.add),
              title: const Text('Add a new address'),
              onTap: () async {
                final a = await context.push<Address>('/account/address');
                if (sheet.mounted) Navigator.pop(sheet, a);
              },
            ),
          ]),
        ),
      );
    }
    if (picked != null) setState(() => _address = picked);
  }

  Future<void> _placeOrder(List<({Product product, int qty})> lines) async {
    setState(() => _busy = true);
    try {
      var order = await ref.read(ordersRepositoryProvider).place(
            address: _address!,
            method: _method,
            items: widget.buyNow == null ? null : [(productId: widget.buyNow!.id, quantity: widget.quantity)],
          );
      if (widget.buyNow == null) ref.invalidate(cartControllerProvider);
      if (!mounted) return;
      if (_method == PaymentMethod.online) {
        final (paid, error) = await payForOrder(context, ref, order);
        if (!mounted) return;
        if (paid == null) {
          showSnack(context, error ?? 'Payment not completed. You can retry from the order page.');
          context.go('/account/orders/${order.id}');
          return;
        }
        order = paid;
      }
      context.go('/order-success/${order.id}');
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Widget _section(String title, Widget child) => Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(border: Border.all(color: DkColors.divider), borderRadius: BorderRadius.circular(12)),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          child,
        ]),
      );

  Widget _row(String k, String v, {bool bold = false}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 4),
        child: Row(children: [
          Expanded(child: Text(k, style: TextStyle(fontSize: bold ? 18 : 15, fontWeight: bold ? FontWeight.w700 : null))),
          Text(v, style: TextStyle(fontSize: bold ? 18 : 15, fontWeight: bold ? FontWeight.w700 : null)),
        ]),
      );
}
