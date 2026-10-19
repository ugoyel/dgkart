import 'dart:convert';

import 'package:dgkart/core/network/demo_backend.dart';
import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

class _Bundle extends CachingAssetBundle {
  _Bundle(this.json);
  final String json;
  @override
  Future<ByteData> load(String key) async => ByteData.sublistView(Uint8List.fromList(utf8.encode(json)));
}

Map<String, dynamic> _product(String id, num price, {bool free = false}) => {
      'id': id, 'sku': 'SKU-$id', 'title': 'Steel Watch $id', 'brand': 'Timeo', 'condition': 'NEW', 'price': price, //
      'mrp': price + 100, 'stock': 5, 'categoryId': 'c1', 'freeShipping': free, 'rating': 4.0, 'reviewCount': 1,
      'soldCount': price, 'thumbnailUrl': 'asset:x.jpg', 'isDummy': true, 'createdAt': '2026-10-05T00:00:00Z',
    };

void main() {
  late Dio dio;
  setUp(() {
    final catalog = jsonEncode({
      'categories': [{'id': 'c1', 'slug': 'watches', 'name': 'Watches', 'imageUrl': null, 'parentId': null, 'sortOrder': 0}],
      'products': [_product('a', 200), _product('b', 300, free: true)],
      'home': {'dailyDeals': ['a'], 'trending': ['b'], 'newArrivals': <String>[]},
    });
    dio = Dio(BaseOptions(baseUrl: 'http://demo/api/v1'))..interceptors.add(DemoBackend(bundle: _Bundle(catalog)));
  });

  Future<Map<String, dynamic>> signIn(String phone) async =>
      (await dio.post('/auth/otp/verify', data: {'phone': phone, 'code': '123456'})).data as Map<String, dynamic>;

  test('search filters and sorts like the API', () async {
    final r = (await dio.get('/products', queryParameters: {'q': 'watch', 'sort': 'price_asc'})).data as Map;
    expect([for (final p in r['items'] as List) p['id']], ['a', 'b']);
    expect(r['total'], 2);
  });

  test('admin number gets the admin role; wrong OTP is refused', () async {
    expect(((await signIn('9910123503'))['user'] as Map)['role'], 'ADMIN');
    expect(((await signIn('9876500000'))['user'] as Map)['role'], 'USER');
    expect(() => dio.post('/auth/otp/verify', data: {'phone': '9876500000', 'code': '000000'}),
        throwsA(isA<DioException>().having((e) => e.response?.statusCode, 'status', 401)));
  });

  test('cart charges delivery under the free-shipping threshold, then order and mock payment', () async {
    final token = (await signIn('9876500000'))['accessToken'];
    dio.options.headers['Authorization'] = 'Bearer $token';
    final cart = (await dio.post('/cart', data: {'productId': 'a', 'quantity': 1})).data as Map;
    expect([cart['subtotal'], cart['shippingFee'], cart['total']], [200, 40, 240]);

    final order = (await dio.post('/orders', data: {'address': {'name': 'T'}, 'paymentMethod': 'ONLINE'})).data as Map;
    expect(order['status'], 'PENDING_PAYMENT');
    expect(((await dio.get('/cart')).data as Map)['count'], 0);

    final g = (await dio.post('/payments/checkout', data: {'orderId': order['id']})).data as Map;
    final paid = (await dio.post('/payments/confirm', data: {
      'orderId': order['id'], 'gatewayOrderId': g['gatewayOrderId'], 'paymentId': 'p1', 'signature': 'mock-success',
    })).data as Map;
    expect(paid['status'], 'PAID');
    expect(((await dio.get('/products/a')).data as Map)['stock'], 4);
  });
}
