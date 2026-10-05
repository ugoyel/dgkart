import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import '../utils/formatters.dart';

class RatingStars extends StatelessWidget {
  const RatingStars({super.key, required this.rating, this.count, this.size = 14});
  final double rating;
  final int? count;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      for (var i = 1; i <= 5; i++)
        Icon(
          rating >= i ? Icons.star : (rating >= i - 0.5 ? Icons.star_half : Icons.star_border),
          size: size,
          color: DkColors.star,
        ),
      if (count != null) ...[
        const SizedBox(width: 4),
        Text('(${formatCompact(count!)})', style: TextStyle(fontSize: size - 2, color: DkColors.textMuted)),
      ],
    ]);
  }
}
