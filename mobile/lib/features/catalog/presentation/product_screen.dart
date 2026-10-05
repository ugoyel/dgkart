import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/utils/formatters.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/net_image.dart';
import '../../../core/widgets/price_text.dart';
import '../../../core/widgets/product_tiles.dart';
import '../../../core/widgets/rating_stars.dart';
import '../../../core/widgets/responsive.dart';
import '../../auth/presentation/require_login.dart';
import '../../cart/presentation/cart_controller.dart';
import '../../watchlist/presentation/watchlist_controller.dart';
import '../domain/product.dart';
import 'catalog_providers.dart';
import 'home_screen.dart';

class ProductScreen extends ConsumerWidget {
  const ProductScreen({super.key, required this.productId});
  final String productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final product = ref.watch(productProvider(productId));
    ref.listen(productProvider(productId), (_, next) {
      final p = next.value;
      if (p != null) Future.microtask(() => ref.read(recentlyViewedProvider.notifier).add(p));
    });
    return Scaffold(
      appBar: AppBar(
        actions: [
          IconButton(icon: const Icon(Icons.search), onPressed: () => context.push('/search')),
          const CartIconButton(),
        ],
      ),
      body: AsyncView(
        value: product,
        onRetry: () => ref.invalidate(productProvider(productId)),
        data: (p) => _ProductBody(product: p),
      ),
    );
  }
}

class _ProductBody extends ConsumerWidget {
  const _ProductBody({required this.product});
  final Product product;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = product;
    final wide = MediaQuery.sizeOf(context).width >= 900;
    final gallery = _Gallery(urls: p.imageUrls);
    final details = _Details(product: p);
    return ListView(children: [
      ContentWidth(
        child: wide
            ? Padding(
                padding: const EdgeInsets.all(16),
                child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Expanded(flex: 5, child: gallery),
                  const SizedBox(width: 32),
                  Expanded(flex: 4, child: details),
                ]),
              )
            : Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [gallery, details]),
      ),
      ContentWidth(child: _Similar(productId: p.id)),
      const SizedBox(height: 32),
    ]);
  }
}

class _Gallery extends StatefulWidget {
  const _Gallery({required this.urls});
  final List<String> urls;

  @override
  State<_Gallery> createState() => _GalleryState();
}

class _GalleryState extends State<_Gallery> {
  int _index = 0;

  @override
  Widget build(BuildContext context) {
    final urls = widget.urls.isEmpty ? <String?>[null] : widget.urls;
    return AspectRatio(
      aspectRatio: 1,
      child: Stack(children: [
        PageView.builder(
          itemCount: urls.length,
          onPageChanged: (i) => setState(() => _index = i),
          itemBuilder: (_, i) => GestureDetector(
            onTap: urls[i] == null ? null : () => _openFullScreen(context, urls.cast<String>(), i),
            child: Container(color: DkColors.surface, child: NetImage(urls[i], fit: BoxFit.contain, radius: 0, cacheWidth: null)),
          ),
        ),
        if (urls.length > 1)
          Positioned(
            right: 12,
            bottom: 12,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(color: Colors.black54, borderRadius: BorderRadius.circular(12)),
              child: Text('${_index + 1} of ${urls.length}', style: const TextStyle(color: Colors.white, fontSize: 12)),
            ),
          ),
      ]),
    );
  }

  void _openFullScreen(BuildContext context, List<String> urls, int start) {
    Navigator.of(context).push(MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(backgroundColor: Colors.black, foregroundColor: Colors.white),
        body: PageView.builder(
          controller: PageController(initialPage: start),
          itemCount: urls.length,
          itemBuilder: (_, i) => InteractiveViewer(child: Center(child: NetImage(urls[i], fit: BoxFit.contain, radius: 0, cacheWidth: null))),
        ),
      ),
    ));
  }
}

class _Details extends ConsumerStatefulWidget {
  const _Details({required this.product});
  final Product product;

  @override
  ConsumerState<_Details> createState() => _DetailsState();
}

class _DetailsState extends ConsumerState<_Details> {
  int _qty = 1;
  bool _busy = false;

  Product get p => widget.product;

  Future<void> _addToCart({bool thenCheckout = false}) async {
    if (!requireLogin(context, ref)) return;
    setState(() => _busy = true);
    try {
      if (thenCheckout) {
        context.push('/checkout', extra: {'buyNow': p, 'quantity': _qty});
      } else {
        await ref.read(cartControllerProvider.notifier).add(p.id, quantity: _qty);
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: const Text('Added to cart'),
          action: SnackBarAction(label: 'View cart', onPressed: () => context.go('/cart')),
        ));
      }
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final watched = ref.watch(isWatchedProvider(p.id));
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Text(p.title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w600, height: 1.3)),
        const SizedBox(height: 8),
        if (p.reviewCount > 0)
          Row(children: [
            RatingStars(rating: p.rating, count: p.reviewCount, size: 16),
            const SizedBox(width: 8),
            if (p.soldCount > 0) Text('${formatCompact(p.soldCount)} sold', style: const TextStyle(color: DkColors.deal, fontWeight: FontWeight.w600)),
          ]),
        const SizedBox(height: 12),
        PriceText(price: p.price, mrp: p.mrp, large: true),
        const SizedBox(height: 4),
        const Text('Inclusive of all taxes', style: TextStyle(fontSize: 12, color: DkColors.textMuted)),
        const SizedBox(height: 16),
        _kv('Condition', p.condition.label, bold: true),
        _kv('Delivery', p.freeShipping ? 'Free delivery in 3-5 days' : '₹40 delivery (free above ₹499)'),
        _kv('Returns', '7 days easy returns'),
        _kv('Availability', p.inStock ? (p.stock < 10 ? 'Only ${p.stock} left' : 'In stock') : 'Out of stock',
            color: p.inStock ? (p.stock < 10 ? DkColors.deal : DkColors.success) : DkColors.deal),
        if (p.inStock) ...[
          const SizedBox(height: 8),
          Row(children: [
            const SizedBox(width: 110, child: Text('Quantity', style: TextStyle(color: DkColors.textMuted))),
            DropdownButton<int>(
              value: _qty,
              items: [for (var i = 1; i <= (p.stock.clamp(1, 10)); i++) DropdownMenuItem(value: i, child: Text('$i'))],
              onChanged: (v) => setState(() => _qty = v ?? 1),
            ),
          ]),
        ],
        const SizedBox(height: 16),
        FilledButton(onPressed: !p.inStock || _busy ? null : () => _addToCart(thenCheckout: true), child: const Text('Buy It Now')),
        const SizedBox(height: 10),
        OutlinedButton(onPressed: !p.inStock || _busy ? null : _addToCart, child: const Text('Add to cart')),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () async {
            if (!requireLogin(context, ref)) return;
            try {
              await ref.read(watchlistProvider.notifier).toggle(p);
            } catch (e) {
              if (context.mounted) showSnack(context, e.toString());
            }
          },
          icon: Icon(watched ? Icons.favorite : Icons.favorite_border),
          label: Text(watched ? 'Watching' : 'Add to Watchlist'),
        ),
        const SizedBox(height: 20),
        const _TrustRow(),
        const Divider(height: 40),
        const Text('About this item', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 12),
        _kv('SKU', p.sku),
        if (p.brand != null) _kv('Brand', p.brand!),
        if (p.categoryName != null) _kv('Category', p.categoryName!),
        for (final e in p.specs.entries.where((e) => e.key != 'Brand')) _kv(e.key, e.value),
        if (p.description.isNotEmpty) ...[
          const SizedBox(height: 16),
          const Text('Item description', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          Text(p.description, style: const TextStyle(height: 1.5)),
        ],
      ]),
    );
  }

  Widget _kv(String k, String v, {bool bold = false, Color? color}) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 5),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 110, child: Text(k, style: const TextStyle(color: DkColors.textMuted))),
          Expanded(child: Text(v, style: TextStyle(fontWeight: bold ? FontWeight.w600 : FontWeight.normal, color: color))),
        ]),
      );
}

class _TrustRow extends StatelessWidget {
  const _TrustRow();

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: DkColors.surface, borderRadius: BorderRadius.circular(12)),
        child: const Row(children: [
          Icon(Icons.verified_user_outlined, color: DkColors.success),
          SizedBox(width: 12),
          Expanded(
            child: Text('DGkart Money Back Guarantee: get the item you ordered or your money back.',
                style: TextStyle(fontSize: 13)),
          ),
        ]),
      );
}

class _Similar extends ConsumerWidget {
  const _Similar({required this.productId});
  final String productId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final items = ref.watch(similarProvider(productId)).value ?? [];
    if (items.isEmpty) return const SizedBox.shrink();
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      const SectionHeader('Similar items'),
      SizedBox(
        height: 290,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: items.length,
          separatorBuilder: (_, _) => const SizedBox(width: 12),
          itemBuilder: (_, i) => ProductCard(product: items[i], width: 160),
        ),
      ),
    ]);
  }
}
