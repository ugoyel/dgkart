import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../auth/presentation/auth_controller.dart';
import '../data/cart_repository_impl.dart';
import '../domain/cart.dart';

final cartControllerProvider = AsyncNotifierProvider<CartController, Cart>(CartController.new);

final cartCountProvider = Provider<int>((ref) => ref.watch(cartControllerProvider).value?.count ?? 0);

class CartController extends AsyncNotifier<Cart> {
  CartRepository get _repo => ref.read(cartRepositoryProvider);

  @override
  Future<Cart> build() async {
    final user = ref.watch(currentUserProvider);
    if (user == null) return const Cart.empty();
    return _repo.get();
  }

  Future<void> add(String productId, {int quantity = 1}) async => state = AsyncData(await _repo.add(productId, quantity: quantity));

  Future<void> setQuantity(String productId, int quantity) async =>
      state = AsyncData(await _repo.setQuantity(productId, quantity));

  Future<void> remove(String productId) async => state = AsyncData(await _repo.remove(productId));

  Future<void> reload() async => state = AsyncData(await _repo.get());
}
