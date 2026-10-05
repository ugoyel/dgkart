import 'package:flutter/material.dart';

/// Breakpoints shared by every screen so the phone app and the future website
/// use one layout system: phone < 600 <= tablet < 1024 <= desktop.
class Responsive {
  static const double maxContentWidth = 1280;

  static bool isPhone(BuildContext c) => MediaQuery.sizeOf(c).width < 600;
  static bool isDesktop(BuildContext c) => MediaQuery.sizeOf(c).width >= 1024;

  static int gridColumns(double width) {
    if (width < 600) return 2;
    if (width < 900) return 3;
    if (width < 1200) return 4;
    return 6;
  }
}

/// Centres content and caps its width on large screens (web/tablet).
class ContentWidth extends StatelessWidget {
  const ContentWidth({super.key, required this.child, this.maxWidth = Responsive.maxContentWidth});
  final Widget child;
  final double maxWidth;

  @override
  Widget build(BuildContext context) => Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(constraints: BoxConstraints(maxWidth: maxWidth), child: child),
      );
}
