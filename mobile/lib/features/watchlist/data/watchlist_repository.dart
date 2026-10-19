import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../catalog/domain/product.dart';

abstract class WatchlistRepository {
  Future<List<Product>> list();
  Future<void> add(String productId);
  Future<void> remove(String productId);
}

final watchlistRepositoryProvider =
    Provider<WatchlistRepository>((ref) => RestWatchlistRepository(ref.watch(apiClientProvider)));

class RestWatchlistRepository implements WatchlistRepository {
  RestWatchlistRepository(this._api);
  final ApiClient _api;

  @override
  Future<List<Product>> list() async =>
      (await _api.get<List<dynamic>>('/watchlist')).map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();

  @override
  Future<void> add(String productId) => _api.put<dynamic>('/watchlist/$productId');

  @override
  Future<void> remove(String productId) => _api.delete<dynamic>('/watchlist/$productId');
}
