import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/widgets/common.dart';
import '../../../core/widgets/product_tiles.dart';
import '../../../core/widgets/responsive.dart';
import 'watchlist_controller.dart';

class WatchlistScreen extends ConsumerWidget {
  const WatchlistScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(watchlistProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Watchlist')),
      body: AsyncView(
        value: list,
        onRetry: () => ref.invalidate(watchlistProvider),
        data: (items) => items.isEmpty
            ? EmptyState(
                icon: Icons.favorite_border,
                title: 'Your watchlist is empty',
                message: 'Tap the heart on any item to keep an eye on it.',
                action: FilledButton(onPressed: () => context.go('/'), child: const Text('Start shopping')),
              )
            : ContentWidth(
                child: ListView.separated(
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (_, i) => ProductListTile(
                    product: items[i],
                    trailing: IconButton(
                      icon: const Icon(Icons.favorite, color: Colors.redAccent),
                      onPressed: () => ref.read(watchlistProvider.notifier).toggle(items[i]),
                    ),
                  ),
                ),
              ),
      ),
    );
  }
}
