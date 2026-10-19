import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../features/account/domain/address.dart';
import '../../features/account/presentation/account_screen.dart';
import '../../features/account/presentation/address_form_screen.dart';
import '../../features/admin/presentation/admin_dashboard_screen.dart';
import '../../features/admin/presentation/admin_orders_screen.dart';
import '../../features/admin/presentation/image_upload_screen.dart';
import '../../features/admin/presentation/sheet_import_screen.dart';
import '../../features/auth/domain/auth_repository.dart';
import '../../features/auth/presentation/auth_controller.dart';
import '../../features/auth/presentation/login_screen.dart';
import '../../features/auth/presentation/otp_screen.dart';
import '../../features/cart/presentation/cart_screen.dart';
import '../../features/catalog/domain/catalog_repository.dart';
import '../../features/catalog/domain/product.dart';
import '../../features/catalog/presentation/categories_screen.dart';
import '../../features/catalog/presentation/home_screen.dart';
import '../../features/catalog/presentation/product_screen.dart';
import '../../features/catalog/presentation/results_screen.dart';
import '../../features/catalog/presentation/search_screen.dart';
import '../../features/orders/presentation/checkout_screen.dart';
import '../../features/orders/presentation/order_screens.dart';
import '../../features/shell/main_shell.dart';
import '../../features/watchlist/presentation/watchlist_screen.dart';

final _rootKey = GlobalKey<NavigatorState>();

/// URL-based routes so the same paths work as website URLs later (/product/:id, /search/results?q=…).
final routerProvider = Provider<GoRouter>((ref) {
  final authChanges = ValueNotifier<int>(0);
  ref.listen(authControllerProvider, (_, _) => authChanges.value++);
  ref.onDispose(authChanges.dispose);

  return GoRouter(
    navigatorKey: _rootKey,
    initialLocation: '/',
    refreshListenable: authChanges,
    redirect: (context, state) {
      final auth = ref.read(authControllerProvider);
      if (auth.isLoading && !auth.hasValue) return null;
      final user = auth.value;
      final path = state.uri.path;
      const needsLogin = ['/checkout', '/account/orders', '/account/watchlist', '/account/address', '/order-success'];
      if (user == null && needsLogin.any(path.startsWith)) {
        return '/login?from=${Uri.encodeComponent(state.uri.toString())}';
      }
      if (path.startsWith('/admin') && !(user?.isAdmin ?? false)) return user == null ? '/login?from=/admin' : '/';
      return null;
    },
    routes: [
      StatefulShellRoute.indexedStack(
        builder: (context, state, shell) => MainShell(shell: shell),
        branches: [
          StatefulShellBranch(routes: [GoRoute(path: '/', builder: (_, _) => const HomeScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/account', builder: (_, _) => const AccountScreen())]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/search', builder: (_, s) => SearchScreen(initial: s.extra as String?)),
          ]),
          StatefulShellBranch(routes: [GoRoute(path: '/cart', builder: (_, _) => const CartScreen())]),
          StatefulShellBranch(routes: [GoRoute(path: '/admin', builder: (_, _) => const AdminDashboardScreen())]),
        ],
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/search/results',
        builder: (_, s) {
          final q = s.uri.queryParameters;
          return ResultsScreen(
            title: q['title'],
            initialQuery: ProductQuery(
              text: q['q'],
              categorySlug: q['category'],
              sort: SortOrder.values.firstWhere((e) => e.code == q['sort'], orElse: () => SortOrder.best),
            ),
          );
        },
      ),
      GoRoute(parentNavigatorKey: _rootKey, path: '/categories', builder: (_, _) => const CategoriesScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: '/product/:id', builder: (_, s) => ProductScreen(productId: s.pathParameters['id']!)),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/login',
        builder: (_, s) => LoginScreen(redirectTo: s.uri.queryParameters['from']),
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/otp',
        redirect: (_, s) => s.extra == null ? '/login' : null,
        builder: (_, s) {
          final extra = s.extra as Map<String, dynamic>;
          return OtpScreen(challenge: extra['challenge'] as OtpChallenge, redirectTo: extra['redirectTo'] as String?);
        },
      ),
      GoRoute(
        parentNavigatorKey: _rootKey,
        path: '/checkout',
        builder: (_, s) {
          final extra = s.extra as Map<String, dynamic>?;
          return CheckoutScreen(buyNow: extra?['buyNow'] as Product?, quantity: (extra?['quantity'] as int?) ?? 1);
        },
      ),
      GoRoute(parentNavigatorKey: _rootKey, path: '/order-success/:id', builder: (_, s) => OrderSuccessScreen(orderId: s.pathParameters['id']!)),
      GoRoute(parentNavigatorKey: _rootKey, path: '/account/orders', builder: (_, _) => const OrdersScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: '/account/orders/:id', builder: (_, s) => OrderDetailScreen(orderId: s.pathParameters['id']!)),
      GoRoute(parentNavigatorKey: _rootKey, path: '/account/watchlist', builder: (_, _) => const WatchlistScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: '/account/addresses', builder: (_, _) => const AddressesScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: '/account/address', builder: (_, s) => AddressFormScreen(existing: s.extra as Address?)),
      GoRoute(parentNavigatorKey: _rootKey, path: '/admin/import/products', builder: (_, _) => const SheetImportScreen(kind: SheetKind.products)),
      GoRoute(parentNavigatorKey: _rootKey, path: '/admin/import/mapping', builder: (_, _) => const SheetImportScreen(kind: SheetKind.mapping)),
      GoRoute(parentNavigatorKey: _rootKey, path: '/admin/images', builder: (_, _) => const ImageUploadScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: '/admin/orders', builder: (_, _) => const AdminOrdersScreen()),
      GoRoute(parentNavigatorKey: _rootKey, path: '/admin/jobs', builder: (_, _) => const AdminJobsScreen()),
    ],
  );
});
