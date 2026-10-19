import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/catalog_repository_impl.dart';
import '../domain/catalog_repository.dart';
import '../domain/category.dart';
import '../domain/product.dart';

final homeFeedProvider = FutureProvider<HomeFeed>((ref) => ref.watch(catalogRepositoryProvider).home());

final categoriesProvider = FutureProvider<List<Category>>((ref) => ref.watch(catalogRepositoryProvider).categories());

final productProvider =
    FutureProvider.autoDispose.family<Product, String>((ref, id) => ref.watch(catalogRepositoryProvider).product(id));

final similarProvider =
    FutureProvider.autoDispose.family<List<Product>, String>((ref, id) => ref.watch(catalogRepositoryProvider).similar(id));

/// Items the user opened this session, newest first (shown on Home).
final recentlyViewedProvider = NotifierProvider<RecentlyViewed, List<Product>>(RecentlyViewed.new);

class RecentlyViewed extends Notifier<List<Product>> {
  @override
  List<Product> build() => const [];

  void add(Product p) => state = [p, ...state.where((e) => e.id != p.id)].take(12).toList();
}

/// Recent search terms, newest first.
final recentSearchesProvider = NotifierProvider<RecentSearches, List<String>>(RecentSearches.new);

class RecentSearches extends Notifier<List<String>> {
  @override
  List<String> build() => const [];

  void add(String q) {
    final t = q.trim();
    if (t.isEmpty) return;
    state = [t, ...state.where((e) => e.toLowerCase() != t.toLowerCase())].take(10).toList();
  }

  void clear() => state = const [];
}
