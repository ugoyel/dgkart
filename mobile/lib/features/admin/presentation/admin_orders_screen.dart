import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/utils/formatters.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/responsive.dart';
import '../../orders/domain/order.dart';
import '../../orders/presentation/order_screens.dart';
import '../data/admin_repository.dart';

class AdminOrdersScreen extends ConsumerWidget {
  const AdminOrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(adminOrdersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('All orders')),
      body: AsyncView(
        value: orders,
        onRetry: () => ref.invalidate(adminOrdersProvider),
        data: (list) => list.isEmpty
            ? const EmptyState(icon: Icons.receipt_long_outlined, title: 'No orders yet')
            : RefreshIndicator(
                onRefresh: () => ref.refresh(adminOrdersProvider.future),
                child: ContentWidth(
                  maxWidth: 900,
                  child: ListView.separated(
                    itemCount: list.length,
                    separatorBuilder: (_, _) => const Divider(height: 1),
                    itemBuilder: (_, i) {
                      final o = list[i];
                      return OrderTile(
                        order: o,
                        onTap: () => _details(context, o),
                        trailing: PopupMenuButton<OrderStatus>(
                          tooltip: 'Change status',
                          onSelected: (s) async {
                            try {
                              await ref.read(adminRepositoryProvider).setOrderStatus(o.id, s);
                              ref.invalidate(adminOrdersProvider);
                            } catch (e) {
                              if (context.mounted) showSnack(context, e.toString());
                            }
                          },
                          itemBuilder: (_) => [
                            for (final s in [OrderStatus.shipped, OrderStatus.delivered, OrderStatus.cancelled])
                              PopupMenuItem(value: s, child: Text('Mark ${s.label.toLowerCase()}')),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ),
      ),
    );
  }

  void _details(BuildContext context, Order o) => showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          title: Text(o.orderNumber),
          content: Text([
            '${o.status.label} • ${formatPrice(o.total)} • ${o.paymentMethod == PaymentMethod.cod ? 'COD' : 'Online'}',
            '',
            for (final l in o.items) '${l.quantity} × ${l.title}',
            '',
            o.address.name,
            o.address.singleLine,
            '+91 ${o.address.phone}',
          ].join('\n')),
          actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
        ),
      );
}

class AdminJobsScreen extends ConsumerWidget {
  const AdminJobsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobs = ref.watch(adminJobsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Import jobs')),
      body: AsyncView(
        value: jobs,
        onRetry: () => ref.invalidate(adminJobsProvider),
        data: (list) => ListView(children: [
          for (final j in list)
            ExpansionTile(
              title: Text('${j.type} • ${j.fileName ?? ''}'),
              subtitle: Text('${j.status} • ${j.upsertedRows} saved • ${j.failedRows} skipped • ${formatDate(j.createdAt)}'),
              children: [
                for (final e in j.errors)
                  ListTile(dense: true, title: Text(e.row > 0 ? 'Row ${e.row}' : 'Error'), subtitle: Text(e.message)),
              ],
            ),
        ]),
      ),
    );
  }
}
