import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';
import '../../catalog/domain/product.dart';
import '../data/watchlist_repository.dart';

final watchlistProvider = AsyncNotifierProvider<WatchlistController, List<Product>>(WatchlistController.new);

final isWatchedProvider = Provider.family<bool, String>(
  (ref, id) => ref.watch(watchlistProvider).value?.any((p) => p.id == id) ?? false,
);

class WatchlistController extends AsyncNotifier<List<Product>> {
  WatchlistRepository get _repo => ref.read(watchlistRepositoryProvider);

  @override
  Future<List<Product>> build() async {
    if (ref.watch(currentUserProvider) == null) return const [];
    return _repo.list();
  }

  Future<void> toggle(Product p) async {
    final current = state.value ?? const [];
    final watching = current.any((e) => e.id == p.id);
    state = AsyncData(watching ? current.where((e) => e.id != p.id).toList() : [p, ...current]);
    try {
      watching ? await _repo.remove(p.id) : await _repo.add(p.id);
    } catch (_) {
      state = AsyncData(current);
      rethrow;
    }
  }
}
