import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/widgets/common.dart';
import '../../../core/widgets/net_image.dart';
import '../../../core/widgets/responsive.dart';
import 'catalog_providers.dart';

class CategoriesScreen extends ConsumerWidget {
  const CategoriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cats = ref.watch(categoriesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('All categories')),
      body: AsyncView(
        value: cats,
        onRetry: () => ref.invalidate(categoriesProvider),
        data: (all) {
          final parents = all.where((c) => c.parentId == null).toList();
          return ContentWidth(
            child: ListView(children: [
              for (final p in parents)
                ExpansionTile(
                  leading: SizedBox(width: 40, height: 40, child: NetImage(p.imageUrl, radius: 20)),
                  title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  children: [
                    ListTile(
                      title: Text('All ${p.name}'),
                      onTap: () => context.push('/search/results?category=${p.slug}&title=${Uri.encodeComponent(p.name)}'),
                    ),
                    for (final c in all.where((c) => c.parentId == p.id))
                      ListTile(
                        title: Text(c.name),
                        onTap: () => context.push('/search/results?category=${c.slug}&title=${Uri.encodeComponent(c.name)}'),
                      ),
                  ],
                ),
            ]),
          );
        },
      ),
    );
  }
}
