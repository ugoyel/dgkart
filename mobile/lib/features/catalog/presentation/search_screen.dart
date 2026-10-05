import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/responsive.dart';
import 'catalog_providers.dart';

/// Search entry: text field, recent searches and category shortcuts.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key, this.initial});
  final String? initial;

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  late final _text = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _text.dispose();
    super.dispose();
  }

  void _submit(String q) {
    if (q.trim().isEmpty) return;
    ref.read(recentSearchesProvider.notifier).add(q);
    context.push('/search/results?q=${Uri.encodeComponent(q.trim())}');
  }

  @override
  Widget build(BuildContext context) {
    final recent = ref.watch(recentSearchesProvider);
    final cats = ref.watch(categoriesProvider).value ?? [];
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: _text,
          autofocus: true,
          textInputAction: TextInputAction.search,
          onSubmitted: _submit,
          decoration: InputDecoration(
            hintText: 'Search on DKKart',
            filled: true,
            fillColor: DkColors.surface,
            isDense: true,
            prefixIcon: const Icon(Icons.search),
            suffixIcon: IconButton(icon: const Icon(Icons.close), onPressed: _text.clear),
            border: const OutlineInputBorder(borderRadius: BorderRadius.all(Radius.circular(24)), borderSide: BorderSide.none),
          ),
        ),
        actions: [TextButton(onPressed: () => _submit(_text.text), child: const Text('Search'))],
      ),
      body: ContentWidth(
        child: ListView(children: [
          if (recent.isNotEmpty) ...[
            ListTile(
              title: const Text('Recent searches', style: TextStyle(fontWeight: FontWeight.w700)),
              trailing: TextButton(
                onPressed: () => ref.read(recentSearchesProvider.notifier).clear(),
                child: const Text('Clear'),
              ),
            ),
            for (final r in recent)
              ListTile(
                leading: const Icon(Icons.history),
                title: Text(r),
                onTap: () => _submit(r),
                trailing: IconButton(icon: const Icon(Icons.north_west, size: 18), onPressed: () => _text.text = r),
              ),
            const Divider(),
          ],
          const ListTile(title: Text('Browse categories', style: TextStyle(fontWeight: FontWeight.w700))),
          for (final c in cats.where((c) => c.parentId == null))
            ListTile(
              leading: const Icon(Icons.category_outlined),
              title: Text(c.name),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => context.push('/search/results?category=${c.slug}&title=${Uri.encodeComponent(c.name)}'),
            ),
        ]),
      ),
    );
  }
}
