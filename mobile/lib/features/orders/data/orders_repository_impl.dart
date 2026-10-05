import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../account/domain/address.dart';
import '../domain/order.dart';

final ordersRepositoryProvider = Provider<OrdersRepository>((ref) => RestOrdersRepository(ref.watch(apiClientProvider)));

class RestOrdersRepository implements OrdersRepository {
  RestOrdersRepository(this._api);
  final ApiClient _api;

  @override
  Future<Order> place({required Address address, required PaymentMethod method, List<({String productId, int quantity})>? items}) async =>
      Order.fromJson(await _api.post<Map<String, dynamic>>('/orders', body: {
        'address': address.toJson(),
        'paymentMethod': method == PaymentMethod.cod ? 'COD' : 'ONLINE',
        if (items != null) 'items': [for (final i in items) {'productId': i.productId, 'quantity': i.quantity}],
      }));

  @override
  Future<List<Order>> mine({int page = 1}) async {
    final j = await _api.get<Map<String, dynamic>>('/orders', query: {'page': page, 'pageSize': 50});
    return (j['items'] as List).map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<Order> get(String id) async => Order.fromJson(await _api.get<Map<String, dynamic>>('/orders/$id'));
}

final myOrdersProvider = FutureProvider.autoDispose<List<Order>>((ref) => ref.watch(ordersRepositoryProvider).mine());
final orderProvider = FutureProvider.autoDispose.family<Order, String>((ref, id) => ref.watch(ordersRepositoryProvider).get(id));
