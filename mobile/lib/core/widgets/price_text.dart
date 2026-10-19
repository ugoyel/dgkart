import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../utils/formatters.dart';

/// Price with optional "Was ₹x" and "% off", as used across listings and product pages.
class PriceText extends StatelessWidget {
  const PriceText({super.key, required this.price, this.mrp, this.large = false});
  final double price;
  final double? mrp;
  final bool large;

  @override
  Widget build(BuildContext context) {
    final off = discountPercent(price, mrp);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(formatPrice(price),
            style: TextStyle(fontSize: large ? 26 : 17, fontWeight: FontWeight.w700, color: DkColors.text)),
        if (off != null)
          Text.rich(
            TextSpan(children: [
              TextSpan(text: large ? 'Was ' : ''),
              TextSpan(
                text: formatPrice(mrp!),
                style: const TextStyle(decoration: TextDecoration.lineThrough),
              ),
              TextSpan(
                text: '  $off% off',
                style: const TextStyle(color: DkColors.deal, fontWeight: FontWeight.w600),
              ),
            ]),
            style: TextStyle(fontSize: large ? 14 : 12, color: DkColors.textMuted),
          ),
      ],
    );
  }
}
