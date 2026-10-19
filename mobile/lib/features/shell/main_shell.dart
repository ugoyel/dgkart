import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/dk_logo.dart';
import '../auth/presentation/auth_controller.dart';
import '../cart/presentation/cart_controller.dart';

/// Bottom navigation on phones, side rail on tablets/web, same destinations.
class MainShell extends ConsumerWidget {
  const MainShell({super.key, required this.shell});
  final StatefulNavigationShell shell;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isAdmin = ref.watch(currentUserProvider)?.isAdmin ?? false;
    final cartCount = ref.watch(cartCountProvider);
    final items = <(IconData, IconData, String, Widget?)>[
      (Icons.home_outlined, Icons.home, 'Home', null),
      (Icons.person_outline, Icons.person, 'My DGkart', null),
      (Icons.search, Icons.search, 'Search', null),
      (
        Icons.shopping_cart_outlined,
        Icons.shopping_cart,
        'Cart',
        cartCount > 0 ? Text('$cartCount') : null,
      ),
      if (isAdmin) (Icons.admin_panel_settings_outlined, Icons.admin_panel_settings, 'Admin', null),
    ];
    final index = shell.currentIndex.clamp(0, items.length - 1);
    void go(int i) => shell.goBranch(i, initialLocation: i == shell.currentIndex);

    Widget icon(IconData data, Widget? badge) =>
        badge == null ? Icon(data) : Badge(label: badge, backgroundColor: DkColors.primary, child: Icon(data));

    if (MediaQuery.sizeOf(context).width >= 900) {
      return Scaffold(
        body: Row(children: [
          NavigationRail(
            selectedIndex: index,
            onDestinationSelected: go,
            labelType: NavigationRailLabelType.all,
            leading: const Padding(padding: EdgeInsets.symmetric(vertical: 16), child: DkLogo(size: 20)),
            destinations: [
              for (final (o, s, l, b) in items)
                NavigationRailDestination(icon: icon(o, b), selectedIcon: icon(s, b), label: Text(l)),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(child: shell),
        ]),
      );
    }
    return Scaffold(
      body: shell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: go,
        destinations: [
          for (final (o, s, l, b) in items) NavigationDestination(icon: icon(o, b), selectedIcon: icon(s, b), label: l),
        ],
      ),
    );
  }
}
