import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/dk_logo.dart';
import '../../../core/widgets/net_image.dart';
import '../../../core/widgets/product_tiles.dart';
import '../../../core/widgets/responsive.dart';
import '../../cart/presentation/cart_controller.dart';
import '../domain/category.dart';
import '../domain/product.dart';
import 'catalog_providers.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(homeFeedProvider);
    final recent = ref.watch(recentlyViewedProvider);
    return Scaffold(
      appBar: AppBar(
        toolbarHeight: 56,
        title: const DkLogo(),
        actions: const [CartIconButton(), SizedBox(width: 4)],
        bottom: const PreferredSize(preferredSize: Size.fromHeight(60), child: SearchLauncher()),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(homeFeedProvider.future),
        child: AsyncView(
          value: feed,
          onRetry: () => ref.invalidate(homeFeedProvider),
          data: (f) => ListView(
            padding: const EdgeInsets.only(bottom: 24),
            children: [
              ContentWidth(
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  _CategoryChips(categories: f.categories),
                  const _PromoCarousel(),
                  const SectionHeader('Shop by category'),
                  _CategoryCircles(categories: f.categories),
                  if (recent.isNotEmpty) ...[
                    const SectionHeader('Your recently viewed items'),
                    _ProductRail(products: recent),
                  ],
                  SectionHeader('Daily Deals', action: 'See all', onAction: () => context.push('/search/results?sort=best')),
                  _ProductRail(products: f.dailyDeals),
                  const SectionHeader('Trending on DKKart'),
                  _ProductRail(products: f.trending),
                  SectionHeader('New arrivals', action: 'See all', onAction: () => context.push('/search/results?sort=newest')),
                  _ProductGrid(products: f.newArrivals),
                ]),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Tappable search pill that opens the search screen (like big marketplace apps).
class SearchLauncher extends StatelessWidget {
  const SearchLauncher({super.key, this.text});
  final String? text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 12),
        child: Material(
          color: DkColors.surface,
          shape: const StadiumBorder(side: BorderSide(color: DkColors.divider)),
          child: InkWell(
            customBorder: const StadiumBorder(),
            onTap: () => context.push('/search', extra: text),
            child: SizedBox(
              height: 44,
              child: Row(children: [
                const SizedBox(width: 14),
                const Icon(Icons.search, color: DkColors.text),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(text ?? 'Search on DKKart',
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(color: text == null ? DkColors.textMuted : DkColors.text, fontSize: 15)),
                ),
                const Icon(Icons.camera_alt_outlined, color: DkColors.textMuted, size: 20),
                const SizedBox(width: 14),
              ]),
            ),
          ),
        ),
      );
}

class CartIconButton extends ConsumerWidget {
  const CartIconButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final count = ref.watch(cartCountProvider);
    return IconButton(
      tooltip: 'Cart',
      onPressed: () => context.go('/cart'),
      icon: Badge(
        isLabelVisible: count > 0,
        label: Text('$count'),
        backgroundColor: DkColors.primary,
        child: const Icon(Icons.shopping_cart_outlined),
      ),
    );
  }
}

class _CategoryChips extends StatelessWidget {
  const _CategoryChips({required this.categories});
  final List<Category> categories;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 48,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
          itemCount: categories.length + 1,
          separatorBuilder: (_, _) => const SizedBox(width: 8),
          itemBuilder: (_, i) => i == 0
              ? ActionChip(label: const Text('All categories'), onPressed: () => context.push('/categories'))
              : ActionChip(
                  label: Text(categories[i - 1].name),
                  onPressed: () => context.push('/search/results?category=${categories[i - 1].slug}&title=${Uri.encodeComponent(categories[i - 1].name)}'),
                ),
        ),
      );
}

class _PromoCarousel extends StatefulWidget {
  const _PromoCarousel();

  @override
  State<_PromoCarousel> createState() => _PromoCarouselState();
}

class _PromoCarouselState extends State<_PromoCarousel> {
  final _controller = PageController();
  Timer? _timer;
  int _page = 0;

  static const _promos = [
    ('Big Savings Days', 'Up to 70% off electronics', 'electronics', [Color(0xFF0F1E3D), Color(0xFF1A56DB)]),
    ('Fashion Fest', 'Styles from ₹299. Free delivery.', 'fashion', [Color(0xFFF97316), Color(0xFFD7263D)]),
    ('Home Makeover', 'Kitchen, decor & furniture deals', 'home-garden', [Color(0xFF138A36), Color(0xFF0B6E4F)]),
    ('Refurbished & Certified', 'Like-new, tested, with warranty', 'mobiles', [Color(0xFF5B21B6), Color(0xFF1A56DB)]),
  ];

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!_controller.hasClients) return;
      _controller.animateToPage((_page + 1) % _promos.length,
          duration: const Duration(milliseconds: 400), curve: Curves.easeOut);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final wide = !Responsive.isPhone(context);
    return Column(children: [
      SizedBox(
        height: wide ? 240 : 170,
        child: PageView.builder(
          controller: _controller,
          itemCount: _promos.length,
          onPageChanged: (p) => setState(() => _page = p),
          itemBuilder: (_, i) {
            final (title, sub, slug, colors) = _promos[i];
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () => context.push('/search/results?category=$slug&title=${Uri.encodeComponent(title)}'),
                child: Ink(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: LinearGradient(colors: colors),
                  ),
                  padding: const EdgeInsets.all(20),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.center, children: [
                    Text(title, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 6),
                    Text(sub, style: const TextStyle(color: Colors.white, fontSize: 15)),
                    const SizedBox(height: 14),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: const ShapeDecoration(color: Colors.white, shape: StadiumBorder()),
                      child: const Text('Shop now', style: TextStyle(fontWeight: FontWeight.w700)),
                    ),
                  ]),
                ),
              ),
            );
          },
        ),
      ),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        for (var i = 0; i < _promos.length; i++)
          AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            margin: const EdgeInsets.all(3),
            width: i == _page ? 18 : 6,
            height: 6,
            decoration: BoxDecoration(
              color: i == _page ? DkColors.text : DkColors.divider,
              borderRadius: BorderRadius.circular(3),
            ),
          ),
      ]),
    ]);
  }
}

class _CategoryCircles extends StatelessWidget {
  const _CategoryCircles({required this.categories});
  final List<Category> categories;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 116,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: categories.length,
          separatorBuilder: (_, _) => const SizedBox(width: 14),
          itemBuilder: (_, i) {
            final c = categories[i];
            return InkWell(
              onTap: () => context.push('/search/results?category=${c.slug}&title=${Uri.encodeComponent(c.name)}'),
              child: SizedBox(
                width: 80,
                child: Column(children: [
                  SizedBox(width: 76, height: 76, child: NetImage(c.imageUrl, radius: 38)),
                  const SizedBox(height: 6),
                  Text(c.name, maxLines: 2, textAlign: TextAlign.center, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12)),
                ]),
              ),
            );
          },
        ),
      );
}

class _ProductRail extends StatelessWidget {
  const _ProductRail({required this.products});
  final List<Product> products;

  @override
  Widget build(BuildContext context) => SizedBox(
        height: 290,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: products.length,
          separatorBuilder: (_, _) => const SizedBox(width: 12),
          itemBuilder: (_, i) => ProductCard(product: products[i], width: 160),
        ),
      );
}

class _ProductGrid extends StatelessWidget {
  const _ProductGrid({required this.products});
  final List<Product> products;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
        builder: (context, c) => GridView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 16),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: Responsive.gridColumns(c.maxWidth),
            mainAxisSpacing: 16,
            crossAxisSpacing: 12,
            childAspectRatio: 0.58,
          ),
          itemCount: products.length,
          itemBuilder: (_, i) => ProductCard(product: products[i]),
        ),
      );
}
