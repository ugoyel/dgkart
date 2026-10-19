import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../features/catalog/domain/product.dart';
import '../theme/app_theme.dart';
import '../utils/formatters.dart';
import 'net_image.dart';
import 'price_text.dart';
import 'rating_stars.dart';

/// Compact card for horizontal rails and grids (home, similar items, watchlist).
class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product, this.width});
  final Product product;
  final double? width;

  @override
  Widget build(BuildContext context) {
    final p = product;
    return SizedBox(
      width: width,
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: () => context.push('/product/${p.id}'),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          AspectRatio(
            aspectRatio: 1,
            child: Stack(fit: StackFit.expand, children: [
              NetImage(p.thumbnailUrl),
              if (p.discount != null)
                Positioned(
                  left: 6,
                  top: 6,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(color: DkColors.deal, borderRadius: BorderRadius.circular(4)),
                    child: Text('${p.discount}% OFF',
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
                  ),
                ),
            ]),
          ),
          const SizedBox(height: 6),
          Text(p.title, maxLines: 2, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13, height: 1.25)),
          const SizedBox(height: 4),
          PriceText(price: p.price, mrp: p.mrp),
          if (p.freeShipping)
            const Text('Free delivery', style: TextStyle(fontSize: 12, color: DkColors.textMuted)),
        ]),
      ),
    );
  }
}

/// Full-width search result row: image left, details right (marketplace list style).
class ProductListTile extends StatelessWidget {
  const ProductListTile({super.key, required this.product, this.trailing});
  final Product product;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final p = product;
    return InkWell(
      onTap: () => context.push('/product/${p.id}'),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
          SizedBox(width: 130, height: 130, child: NetImage(p.thumbnailUrl)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(p.title, maxLines: 3, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 15, height: 1.3)),
              const SizedBox(height: 4),
              Text(p.condition.label, style: const TextStyle(fontSize: 13, color: DkColors.textMuted)),
              const SizedBox(height: 6),
              PriceText(price: p.price, mrp: p.mrp),
              const SizedBox(height: 2),
              Text(p.freeShipping ? 'Free delivery' : '+ ₹40 delivery',
                  style: const TextStyle(fontSize: 13, color: DkColors.textMuted)),
              if (p.soldCount > 0)
                Text('${formatCompact(p.soldCount)} sold',
                    style: const TextStyle(fontSize: 13, color: DkColors.deal, fontWeight: FontWeight.w600)),
              if (p.reviewCount > 0) Padding(
                padding: const EdgeInsets.only(top: 2),
                child: RatingStars(rating: p.rating, count: p.reviewCount, size: 13),
              ),
            ]),
          ),
          ?trailing,
        ]),
      ),
    );
  }
}
