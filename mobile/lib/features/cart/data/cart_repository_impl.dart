import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/cart.dart';

final cartRepositoryProvider = Provider<CartRepository>((ref) => RestCartRepository(ref.watch(apiClientProvider)));

class RestCartRepository implements CartRepository {
  RestCartRepository(this._api);
  final ApiClient _api;

  @override
  Future<Cart> get() async => Cart.fromJson(await _api.get<Map<String, dynamic>>('/cart'));

  @override
  Future<Cart> add(String productId, {int quantity = 1}) async =>
      Cart.fromJson(await _api.post<Map<String, dynamic>>('/cart', body: {'productId': productId, 'quantity': quantity}));

  @override
  Future<Cart> setQuantity(String productId, int quantity) async =>
      Cart.fromJson(await _api.patch<Map<String, dynamic>>('/cart/$productId', body: {'quantity': quantity}));

  @override
  Future<Cart> remove(String productId) async => Cart.fromJson(await _api.delete<Map<String, dynamic>>('/cart/$productId'));
}
