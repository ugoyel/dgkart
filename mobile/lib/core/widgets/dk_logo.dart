import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

/// DKKart wordmark drawn in text (no image assets needed).
class DkLogo extends StatelessWidget {
  const DkLogo({super.key, this.size = 26, this.showDomain = false});
  final double size;
  final bool showDomain;

  @override
  Widget build(BuildContext context) {
    final base = TextStyle(fontSize: size, fontWeight: FontWeight.w900, letterSpacing: -1, height: 1);
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.end,
      children: [
        Text('DK', style: base.copyWith(color: DkColors.navy)),
        Text('Kart', style: base.copyWith(color: DkColors.accent)),
        if (showDomain)
          Padding(
            padding: const EdgeInsets.only(left: 6, bottom: 2),
            child: Text('DGkart.com', style: TextStyle(fontSize: size * 0.4, color: DkColors.textMuted)),
          ),
      ],
    );
  }
}
