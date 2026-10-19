import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/product_tiles.dart';
import '../../../core/widgets/responsive.dart';
import '../data/catalog_repository_impl.dart';
import '../domain/catalog_repository.dart';
import '../domain/product.dart';
import 'home_screen.dart';

/// Search results with sort/filter chips and infinite scroll (pages of 20).
class ResultsScreen extends ConsumerStatefulWidget {
  const ResultsScreen({super.key, required this.initialQuery, this.title});
  final ProductQuery initialQuery;
  final String? title;

  @override
  ConsumerState<ResultsScreen> createState() => _ResultsScreenState();
}

class _ResultsScreenState extends ConsumerState<ResultsScreen> {
  late ProductQuery _query = widget.initialQuery;
  final _items = <Product>[];
  final _scroll = ScrollController();
  int _page = 0;
  int _total = 0;
  bool _hasMore = true;
  bool _loading = false;
  Object? _error;
  bool _grid = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      if (_scroll.position.pixels > _scroll.position.maxScrollExtent - 600) _loadMore();
    });
    _loadMore();
  }

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _loadMore() async {
    if (_loading || !_hasMore) return;
    setState(() => _loading = true);
    try {
      final page = await ref.read(catalogRepositoryProvider).search(_query, page: _page + 1);
      if (!mounted) return;
      setState(() {
        _items.addAll(page.items);
        _page = page.page;
        _total = page.total;
        _hasMore = page.hasMore;
        _error = null;
      });
    } catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _apply(ProductQuery q) {
    setState(() {
      _query = q;
      _items.clear();
      _page = 0;
      _hasMore = true;
      _error = null;
    });
    _loadMore();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title ?? (_query.text ?? 'Results')),
        actions: [
          IconButton(
            tooltip: _grid ? 'List view' : 'Gallery view',
            icon: Icon(_grid ? Icons.view_list : Icons.grid_view),
            onPressed: () => setState(() => _grid = !_grid),
          ),
          const CartIconButton(),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(104),
          child: Column(children: [
            SearchLauncher(text: _query.text),
            _FilterBar(query: _query, onChanged: _apply),
          ]),
        ),
      ),
      body: ContentWidth(child: _body()),
    );
  }

  Widget _body() {
    if (_items.isEmpty && _loading) return const Center(child: CircularProgressIndicator());
    if (_items.isEmpty && _error != null) {
      return EmptyState(
        icon: Icons.cloud_off,
        title: 'Could not load results',
        message: '$_error',
        action: OutlinedButton(onPressed: () => _apply(_query), child: const Text('Try again')),
      );
    }
    if (_items.isEmpty) {
      return const EmptyState(icon: Icons.search_off, title: 'No exact matches found', message: 'Try fewer words or remove filters.');
    }
    final header = Padding(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
      child: Text('${formatCompact(_total)} results', style: const TextStyle(fontWeight: FontWeight.w700)),
    );
    final footer = _hasMore
        ? const Padding(padding: EdgeInsets.all(24), child: Center(child: CircularProgressIndicator()))
        : const SizedBox(height: 24);

    if (_grid) {
      return LayoutBuilder(
        builder: (context, c) => CustomScrollView(controller: _scroll, slivers: [
          SliverToBoxAdapter(child: header),
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: SliverGrid(
              gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: Responsive.gridColumns(c.maxWidth),
                mainAxisSpacing: 16,
                crossAxisSpacing: 12,
                childAspectRatio: 0.58,
              ),
              delegate: SliverChildBuilderDelegate((_, i) => ProductCard(product: _items[i]), childCount: _items.length),
            ),
          ),
          SliverToBoxAdapter(child: footer),
        ]),
      );
    }
    return ListView.separated(
      controller: _scroll,
      itemCount: _items.length + 2,
      separatorBuilder: (_, i) => i == 0 ? const SizedBox.shrink() : const Divider(height: 1, indent: 16, endIndent: 16),
      itemBuilder: (_, i) {
        if (i == 0) return header;
        if (i == _items.length + 1) return footer;
        return ProductListTile(product: _items[i - 1]);
      },
    );
  }
}

class _FilterBar extends StatelessWidget {
  const _FilterBar({required this.query, required this.onChanged});
  final ProductQuery query;
  final ValueChanged<ProductQuery> onChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        children: [
          _chip(context, Icons.swap_vert, query.sort.label, true, () => _pickSort(context)),
          _chip(context, null, query.condition?.label ?? 'Condition', query.condition != null, () => _pickCondition(context)),
          _chip(context, null, _priceLabel(), query.minPrice != null || query.maxPrice != null, () => _pickPrice(context)),
          _chip(context, null, 'Free delivery', query.freeShipping,
              () => onChanged(query.copyWith(freeShipping: !query.freeShipping))),
        ],
      ),
    );
  }

  String _priceLabel() {
    if (query.minPrice == null && query.maxPrice == null) return 'Price';
    final lo = query.minPrice == null ? '' : formatPrice(query.minPrice!);
    final hi = query.maxPrice == null ? '+' : ' - ${formatPrice(query.maxPrice!)}';
    return '$lo$hi';
  }

  Widget _chip(BuildContext context, IconData? icon, String label, bool selected, VoidCallback onTap) => Padding(
        padding: const EdgeInsets.only(right: 8),
        child: FilterChip(
          avatar: icon == null ? null : Icon(icon, size: 16, color: selected ? Colors.white : DkColors.text),
          label: Text(label),
          selected: selected && icon == null,
          showCheckmark: false,
          labelStyle: TextStyle(color: selected && icon == null ? Colors.white : DkColors.text),
          onSelected: (_) => onTap(),
        ),
      );

  Future<void> _pickSort(BuildContext context) async {
    final s = await showModalBottomSheet<SortOrder>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const ListTile(title: Text('Sort', style: TextStyle(fontWeight: FontWeight.w700))),
          RadioGroup<SortOrder>(
            groupValue: query.sort,
            onChanged: (v) => Navigator.pop(context, v),
            child: Column(children: [
              for (final s in SortOrder.values) RadioListTile<SortOrder>(value: s, title: Text(s.label)),
            ]),
          ),
        ]),
      ),
    );
    if (s != null) onChanged(query.copyWith(sort: s));
  }

  Future<void> _pickCondition(BuildContext context) async {
    final c = await showModalBottomSheet<Object>(
      context: context,
      builder: (_) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const ListTile(title: Text('Condition', style: TextStyle(fontWeight: FontWeight.w700))),
          ListTile(title: const Text('Any condition'), onTap: () => Navigator.pop(context, 'any')),
          for (final c in ProductCondition.values) ListTile(title: Text(c.label), onTap: () => Navigator.pop(context, c)),
        ]),
      ),
    );
    if (c == 'any') onChanged(query.copyWith(clearCondition: true));
    if (c is ProductCondition) onChanged(query.copyWith(condition: c));
  }

  Future<void> _pickPrice(BuildContext context) async {
    final min = TextEditingController(text: query.minPrice?.toStringAsFixed(0));
    final max = TextEditingController(text: query.maxPrice?.toStringAsFixed(0));
    final ok = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        title: const Text('Price range'),
        content: Row(children: [
          Expanded(child: TextField(controller: min, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Min ₹'))),
          const SizedBox(width: 12),
          Expanded(child: TextField(controller: max, keyboardType: TextInputType.number, decoration: const InputDecoration(labelText: 'Max ₹'))),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Clear')),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size(88, 40)),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Apply'),
          ),
        ],
      ),
    );
    if (ok == null) return;
    if (!ok) return onChanged(query.copyWith(clearPrice: true));
    onChanged(query.copyWith(clearPrice: true).copyWith(
          minPrice: double.tryParse(min.text),
          maxPrice: double.tryParse(max.text),
        ));
  }
}
