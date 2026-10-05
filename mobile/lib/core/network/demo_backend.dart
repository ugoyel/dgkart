import 'dart:convert';
import 'dart:math';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';

/// Answers API calls inside the app from a bundled catalogue, for builds made
/// with `--dart-define=DEMO_MODE=true`. It follows the REST API's rules
/// (search, pricing, cart, orders, mock payments, admin) so the whole app can
/// be tried with no server. State lives in memory and resets when the app
/// restarts. Regenerate the catalogue with `mobile/tool/build_demo_data.mjs`.
class DemoBackend extends Interceptor {
  DemoBackend({AssetBundle? bundle}) : _bundle = bundle ?? rootBundle;

  final AssetBundle _bundle;
  final _rand = Random();

  List<Map<String, dynamic>> _categories = [];
  List<Map<String, dynamic>> _seedProducts = [];
  List<Map<String, dynamic>> _products = [];
  Map<String, List<String>> _home = {};
  Future<void>? _loading;

  final _users = <String, Map<String, dynamic>>{}; // by phone
  final _carts = <String, List<Map<String, dynamic>>>{}; // userId -> [{productId, quantity}]
  final _watch = <String, List<String>>{}; // userId -> productIds
  final _orders = <Map<String, dynamic>>[];
  final _jobs = <Map<String, dynamic>>[];

  static const _adminPhone = '+919910123503';
  static const _testOtp = '123456';
  static const _freeShippingThreshold = 499;
  static const _shippingFee = 40;
  static const _listFields = [
    'id', 'sku', 'title', 'brand', 'condition', 'price', 'mrp', 'stock', 'categoryId', 'freeShipping', //
    'rating', 'reviewCount', 'soldCount', 'thumbnailUrl',
  ];

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    try {
      await (_loading ??= _load());
      await Future<void>.delayed(Duration(milliseconds: 120 + _rand.nextInt(180)));
      final data = _route(options);
      handler.resolve(Response(requestOptions: options, statusCode: 200, data: data));
    } on _DemoError catch (e) {
      handler.reject(DioException(
        requestOptions: options,
        type: DioExceptionType.badResponse,
        response: Response(requestOptions: options, statusCode: e.status, data: {'statusCode': e.status, 'message': e.message}),
      ));
    }
  }

  Future<void> _load() async {
    final j = jsonDecode(await _bundle.loadString('assets/demo/catalog.json')) as Map<String, dynamic>;
    _categories = (j['categories'] as List).cast<Map<String, dynamic>>();
    _seedProducts = (j['products'] as List).cast<Map<String, dynamic>>();
    _products = [for (final p in _seedProducts) Map.of(p)];
    _home = (j['home'] as Map).map((k, v) => MapEntry(k as String, (v as List).cast<String>()));
  }

  // ---------------------------------------------------------------- routing

  Object? _route(RequestOptions o) {
    final method = o.method.toUpperCase();
    final seg = Uri.parse(o.path).pathSegments.where((s) => s.isNotEmpty).toList();
    final q = o.queryParameters;
    final body = o.data is Map ? (o.data as Map).cast<String, dynamic>() : const <String, dynamic>{};
    final route = '$method /${seg.join('/')}';

    // Public catalogue.
    if (route == 'GET /home') return _homeFeed();
    if (route == 'GET /categories') return _sortedCategories(_categories);
    if (route == 'GET /products') return _search(q);
    if (method == 'GET' && seg.length == 2 && seg[0] == 'products') return _product(seg[1]);
    if (method == 'GET' && seg.length == 3 && seg[0] == 'products' && seg[2] == 'similar') return _similar(seg[1]);

    // Sign-in.
    if (route == 'POST /auth/otp/request') return {'sent': true, 'hint': 'Demo mode: use OTP $_testOtp'};
    if (route == 'POST /auth/otp/verify') return _verify(body);
    if (route == 'POST /auth/firebase') throw _DemoError(400, 'Firebase sign-in is not available in the demo.');

    final user = _currentUser(o);
    final uid = user['id'] as String;

    if (route == 'GET /users/me') return user;
    if (route == 'PATCH /users/me') return user..addAll({...body}..removeWhere((k, _) => k != 'name' && k != 'email'));
    if (route == 'PUT /users/me/addresses') return user..['addresses'] = body['addresses'];
    if (route == 'DELETE /users/me') {
      _users.remove(user['phone']);
      return {'deleted': true};
    }

    if (route == 'GET /cart') return _cartView(uid);
    if (route == 'POST /cart') return _addToCart(uid, body['productId'] as String, (body['quantity'] as num? ?? 1).toInt());
    if (method == 'PATCH' && seg.length == 2 && seg[0] == 'cart') return _setQuantity(uid, seg[1], (body['quantity'] as num).toInt());
    if (method == 'DELETE' && seg.length == 2 && seg[0] == 'cart') {
      _cart(uid).removeWhere((l) => l['productId'] == seg[1]);
      return _cartView(uid);
    }

    if (route == 'GET /watchlist') {
      return [for (final id in _watch[uid] ?? const <String>[]) ?_products.where((p) => p['id'] == id).firstOrNull];
    }
    if (seg.length == 2 && seg[0] == 'watchlist' && (method == 'PUT' || method == 'DELETE')) {
      final list = _watch.putIfAbsent(uid, () => []);
      list.remove(seg[1]);
      if (method == 'PUT') list.insert(0, seg[1]);
      return {'watching': method == 'PUT'};
    }

    if (route == 'POST /orders') return _placeOrder(user, body);
    if (route == 'GET /orders') return _page(_orders.where((x) => x['userId'] == uid).toList(), q);
    if (method == 'GET' && seg.length == 2 && seg[0] == 'orders') return _order(seg[1], uid);

    if (route == 'POST /payments/checkout') return _checkout(uid, body['orderId'] as String);
    if (route == 'POST /payments/confirm') return _confirm(uid, body);
    if (route == 'POST /payments/fail') {
      final order = _order(body['orderId'] as String, uid);
      if (order['status'] == 'PENDING_PAYMENT') _setStatus(order, 'PAYMENT_FAILED');
      return order;
    }

    if (seg.isNotEmpty && seg[0] == 'admin') {
      if (user['role'] != 'ADMIN') throw _DemoError(403, 'Admins only.');
      return _admin(method, seg.sublist(1), q, body);
    }
    throw _DemoError(404, 'Not found');
  }

  // --------------------------------------------------------------- catalogue

  List<Map<String, dynamic>> _sortedCategories(Iterable<Map<String, dynamic>> list) =>
      list.toList()..sort((a, b) => (a['sortOrder'] as num).compareTo(b['sortOrder'] as num));

  Map<String, dynamic> _summary(Map<String, dynamic> p) => {for (final f in _listFields) f: p[f]};

  Map<String, dynamic> _homeFeed() {
    List<Map<String, dynamic>> pick(String key) =>
        [for (final id in _home[key] ?? const <String>[]) ?_products.where((p) => p['id'] == id).map(_summary).firstOrNull];
    return {
      'categories': _sortedCategories(_categories.where((c) => c['parentId'] == null)),
      'dailyDeals': pick('dailyDeals'),
      'trending': pick('trending'),
      'newArrivals': pick('newArrivals'),
    };
  }

  Map<String, dynamic> _search(Map<String, dynamic> q) {
    Iterable<Map<String, dynamic>> items = _products;
    final text = (q['q'] as String?)?.trim().toLowerCase();
    if (text != null && text.isNotEmpty) {
      items = items.where((p) =>
          (p['title'] as String).toLowerCase().contains(text) ||
          (p['brand'] as String? ?? '').toLowerCase().contains(text) ||
          (p['sku'] as String).toLowerCase() == text);
    }
    final slug = q['category'] as String?;
    if (slug != null) {
      final cat = _categories.where((c) => c['slug'] == slug).firstOrNull;
      final ids = {
        if (cat != null) cat['id'],
        for (final c in _categories) if (cat != null && c['parentId'] == cat['id']) c['id'],
      };
      items = items.where((p) => ids.contains(p['categoryId']));
    }
    final min = num.tryParse('${q['minPrice'] ?? ''}');
    final max = num.tryParse('${q['maxPrice'] ?? ''}');
    if (min != null) items = items.where((p) => (p['price'] as num) >= min);
    if (max != null) items = items.where((p) => (p['price'] as num) <= max);
    if (q['condition'] != null) items = items.where((p) => p['condition'] == q['condition']);
    if ('${q['freeShipping']}' == 'true') items = items.where((p) => p['freeShipping'] == true);

    final list = items.toList();
    int by(String k, Map a, Map b) => (a[k] as Comparable).compareTo(b[k]);
    switch (q['sort']) {
      case 'price_asc':
        list.sort((a, b) => by('price', a, b));
      case 'price_desc':
        list.sort((a, b) => by('price', b, a));
      case 'newest':
        list.sort((a, b) => by('createdAt', b, a));
      default:
        list.sort((a, b) => by('soldCount', b, a) != 0 ? by('soldCount', b, a) : by('rating', b, a));
    }
    return _page(list.map(_summary).toList(), q);
  }

  Map<String, dynamic> _page(List<Map<String, dynamic>> all, Map<String, dynamic> q) {
    final page = int.tryParse('${q['page'] ?? ''}') ?? 1;
    final size = int.tryParse('${q['pageSize'] ?? ''}') ?? 20;
    final start = min((page - 1) * size, all.length);
    final end = min(start + size, all.length);
    return {'items': all.sublist(start, end), 'page': page, 'pageSize': size, 'total': all.length, 'hasMore': end < all.length};
  }

  Map<String, dynamic> _find(String id) =>
      _products.where((p) => p['id'] == id).firstOrNull ?? (throw _DemoError(404, 'Product not found'));

  Map<String, dynamic> _product(String id) {
    final p = _find(id);
    return {...p, 'category': _categories.where((c) => c['id'] == p['categoryId']).firstOrNull};
  }

  List<Map<String, dynamic>> _similar(String id) {
    final p = _find(id);
    return (_products.where((x) => x['categoryId'] == p['categoryId'] && x['id'] != id).toList()
          ..sort((a, b) => (b['soldCount'] as num).compareTo(a['soldCount'] as num)))
        .take(12)
        .map(_summary)
        .toList();
  }

  // ---------------------------------------------------------------- accounts

  String _now() => DateTime.now().toUtc().toIso8601String();

  String _id() {
    String hex(int n) => List.generate(n, (_) => _rand.nextInt(16).toRadixString(16)).join();
    return '${hex(8)}-${hex(4)}-4${hex(3)}-a${hex(3)}-${hex(12)}';
  }

  static String _normalizePhone(String raw) {
    final digits = raw.replaceAll(RegExp(r'\D'), '');
    final local = digits.length > 10 ? digits.substring(digits.length - 10) : digits;
    return '+91$local';
  }

  Map<String, dynamic> _userFor(String phone) => _users.putIfAbsent(phone, () {
        final now = _now();
        return {
          'id': _id(), 'phone': phone, 'name': null, 'email': null, //
          'role': phone == _adminPhone ? 'ADMIN' : 'USER', 'addresses': <dynamic>[], 'createdAt': now, 'updatedAt': now,
        };
      });

  Map<String, dynamic> _verify(Map<String, dynamic> body) {
    final digits = '${body['phone'] ?? ''}'.replaceAll(RegExp(r'\D'), '');
    if (digits.length < 10) throw _DemoError(400, 'Enter a valid 10-digit mobile number.');
    if (body['code'] != _testOtp) throw _DemoError(401, 'Incorrect OTP. In the demo the OTP is $_testOtp.');
    final user = _userFor(_normalizePhone(digits));
    return {'accessToken': 'demo.${user['phone']}', 'user': user};
  }

  /// Demo tokens carry the phone number, so a saved session survives an app restart.
  Map<String, dynamic> _currentUser(RequestOptions o) {
    final auth = o.headers['Authorization'] as String? ?? '';
    const prefix = 'Bearer demo.';
    if (!auth.startsWith(prefix)) throw _DemoError(401, 'Please sign in.');
    return _userFor(auth.substring(prefix.length));
  }

  // -------------------------------------------------------------------- cart

  List<Map<String, dynamic>> _cart(String uid) => _carts.putIfAbsent(uid, () => []);

  Map<String, dynamic> _totals(Iterable<({num unitPrice, int quantity, bool freeShipping})> lines) {
    final subtotal = lines.fold<num>(0, (s, l) => s + l.unitPrice * l.quantity);
    final allFree = lines.isNotEmpty && lines.every((l) => l.freeShipping);
    final fee = lines.isEmpty || allFree || subtotal >= _freeShippingThreshold ? 0 : _shippingFee;
    return {'subtotal': subtotal, 'shippingFee': fee, 'total': subtotal + fee};
  }

  Map<String, dynamic> _cartView(String uid) {
    final items = [
      for (final l in _cart(uid))
        if (_products.where((p) => p['id'] == l['productId']).firstOrNull case final p?)
          {
            'productId': p['id'], 'quantity': l['quantity'], //
            'product': {for (final f in ['id', 'title', 'price', 'mrp', 'thumbnailUrl', 'stock', 'condition', 'freeShipping']) f: p[f]},
          },
    ];
    return {
      'items': items,
      'count': items.fold<int>(0, (s, i) => s + (i['quantity'] as int)),
      ..._totals(items.map((i) {
        final p = i['product'] as Map;
        return (unitPrice: p['price'] as num, quantity: i['quantity'] as int, freeShipping: p['freeShipping'] as bool);
      })),
    };
  }

  Map<String, dynamic> _addToCart(String uid, String productId, int quantity) {
    final p = _find(productId);
    final line = _cart(uid).where((l) => l['productId'] == productId).firstOrNull;
    final next = (line?['quantity'] as int? ?? 0) + quantity;
    if (next > (p['stock'] as num)) throw _DemoError(400, 'Only ${p['stock']} left in stock.');
    if (line == null) {
      _cart(uid).add({'productId': productId, 'quantity': next});
    } else {
      line['quantity'] = next;
    }
    return _cartView(uid);
  }

  Map<String, dynamic> _setQuantity(String uid, String productId, int quantity) {
    final p = _find(productId);
    if (quantity > (p['stock'] as num)) throw _DemoError(400, 'Only ${p['stock']} left in stock.');
    for (final l in _cart(uid)) {
      if (l['productId'] == productId) l['quantity'] = quantity;
    }
    return _cartView(uid);
  }

  // ------------------------------------------------------------------ orders

  Map<String, dynamic> _placeOrder(Map<String, dynamic> user, Map<String, dynamic> body) {
    final uid = user['id'] as String;
    final requested = body['items'] is List
        ? [for (final l in body['items'] as List) {'productId': l['productId'], 'quantity': (l['quantity'] as num).toInt()}]
        : _cart(uid);
    if (requested.isEmpty) throw _DemoError(400, 'Your cart is empty.');
    final lines = <Map<String, dynamic>>[];
    for (final l in requested) {
      final p = _find(l['productId'] as String);
      final qty = l['quantity'] as int;
      if (qty > (p['stock'] as num)) throw _DemoError(400, '${p['title']}: only ${p['stock']} left in stock.');
      lines.add({
        'productId': p['id'], 'sku': p['sku'], 'title': p['title'], 'imageUrl': p['thumbnailUrl'], //
        'unitPrice': p['price'], 'quantity': qty, '_free': p['freeShipping'],
      });
    }
    for (final l in lines) {
      final p = _find(l['productId'] as String);
      p['stock'] = (p['stock'] as num) - (l['quantity'] as int);
    }
    final totals = _totals(lines.map((l) => (unitPrice: l['unitPrice'] as num, quantity: l['quantity'] as int, freeShipping: l['_free'] as bool)));
    for (final l in lines) {
      l.remove('_free');
    }
    final cod = body['paymentMethod'] == 'COD';
    final now = DateTime.now();
    final order = {
      'id': _id(),
      'orderNumber': 'DG${now.year % 100}${now.month.toString().padLeft(2, '0')}${now.day.toString().padLeft(2, '0')}'
          '${_rand.nextInt(100000000).toString().padLeft(8, '0')}',
      'userId': uid,
      'status': cod ? 'CONFIRMED_COD' : 'PENDING_PAYMENT',
      'paymentMethod': cod ? 'COD' : 'ONLINE',
      'items': lines,
      ...totals,
      'shippingAddress': body['address'],
      'payment': <String, dynamic>{},
      'createdAt': _now(),
      'updatedAt': _now(),
    };
    _orders.insert(0, order);
    if (body['items'] is! List) _cart(uid).clear();
    return order;
  }

  Map<String, dynamic> _order(String id, String? uid) =>
      _orders.where((o) => o['id'] == id && (uid == null || o['userId'] == uid)).firstOrNull ??
      (throw _DemoError(404, 'Order not found'));

  void _setStatus(Map<String, dynamic> order, String status) {
    final releases = status == 'CANCELLED' || status == 'PAYMENT_FAILED';
    final held = order['status'] != 'CANCELLED' && order['status'] != 'PAYMENT_FAILED';
    if (releases && held) {
      for (final l in order['items'] as List) {
        final p = _products.where((x) => x['id'] == l['productId']).firstOrNull;
        if (p != null) p['stock'] = (p['stock'] as num) + (l['quantity'] as num);
      }
    }
    order['status'] = status;
    order['updatedAt'] = _now();
  }

  Map<String, dynamic> _checkout(String uid, String orderId) {
    final order = _order(orderId, uid);
    if (order['status'] != 'PENDING_PAYMENT') throw _DemoError(400, 'This order does not need payment.');
    final g = {'provider': 'mock', 'gatewayOrderId': 'mock_${_id()}', 'amount': ((order['total'] as num) * 100).round(), 'currency': 'INR'};
    (order['payment'] as Map)['provider'] = 'mock';
    (order['payment'] as Map)['gatewayOrderId'] = g['gatewayOrderId'];
    return {...g, 'orderId': order['id'], 'orderNumber': order['orderNumber'], 'brand': 'DKKart'};
  }

  Map<String, dynamic> _confirm(String uid, Map<String, dynamic> body) {
    final order = _order(body['orderId'] as String, uid);
    if (order['status'] == 'PAID') return order;
    if (body['signature'] != 'mock-success') throw _DemoError(400, 'Payment could not be verified.');
    (order['payment'] as Map)['paymentId'] = body['paymentId'];
    _setStatus(order, 'PAID');
    return order;
  }

  // ------------------------------------------------------------------- admin

  Object? _admin(String method, List<String> seg, Map<String, dynamic> q, Map<String, dynamic> body) {
    final route = '$method /${seg.join('/')}';
    const paidStatuses = {'PAID', 'CONFIRMED_COD', 'SHIPPED', 'DELIVERED'};
    switch (route) {
      case 'GET /stats':
        return {
          'products': _products.length,
          'dummyProducts': _products.where((p) => p['isDummy'] == true).length,
          'productsWithoutImages': _products.where((p) => p['thumbnailUrl'] == null).length,
          'users': _users.length,
          'orders': _orders.length,
          'revenue': _orders.where((o) => paidStatuses.contains(o['status'])).fold<num>(0, (s, o) => s + (o['total'] as num)),
          'imageMappings': 0,
        };
      case 'GET /jobs':
        return _jobs;
      case 'POST /seed':
        final restored = _seedProducts.where((s) => !_products.any((p) => p['id'] == s['id'])).map(Map.of).toList();
        _products.addAll(restored);
        final now = _now();
        final job = {
          'id': _id(), 'type': 'SEED', 'status': 'DONE', 'fileName': null, //
          'totalRows': restored.length, 'processedRows': restored.length, 'upsertedRows': restored.length, 'failedRows': 0,
          'errors': <dynamic>[], 'createdAt': now, 'updatedAt': now,
        };
        _jobs.insert(0, job);
        return job;
      case 'DELETE /products/dummy':
        final before = _products.length;
        _products.removeWhere((p) => p['isDummy'] == true);
        return {'deleted': before - _products.length};
      case 'POST /products/wipe-all':
        final n = _products.length;
        _products.clear();
        return {'deleted': n};
      case 'GET /orders':
        final status = q['status'] as String?;
        return _page(_orders.where((o) => status == null || o['status'] == status).toList(), q);
      case 'POST /import/products':
      case 'POST /import/image-mapping':
      case 'POST /images':
        throw _DemoError(400, 'This is the offline demo, so files cannot be uploaded. Uploads work when the app is connected to the DKKart server.');
    }
    if (method == 'GET' && seg.length == 2 && seg[0] == 'jobs') {
      return _jobs.where((j) => j['id'] == seg[1]).firstOrNull ?? (throw _DemoError(404, 'Job not found'));
    }
    if (method == 'PATCH' && seg.length == 3 && seg[0] == 'orders' && seg[2] == 'status') {
      final order = _order(seg[1], null);
      _setStatus(order, body['status'] as String);
      return order;
    }
    if (method == 'DELETE' && seg.length == 2 && seg[0] == 'products') {
      _products.removeWhere((p) => p['id'] == seg[1]);
      return {'deleted': true};
    }
    throw _DemoError(404, 'Not found');
  }
}

class _DemoError implements Exception {
  _DemoError(this.status, this.message);
  final int status;
  final String message;
}
