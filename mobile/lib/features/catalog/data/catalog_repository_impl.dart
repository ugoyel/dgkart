import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/catalog_repository.dart';
import '../domain/category.dart';
import '../domain/paged.dart';
import '../domain/product.dart';

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) => RestCatalogRepository(ref.watch(apiClientProvider)));

class RestCatalogRepository implements CatalogRepository {
  RestCatalogRepository(this._api);
  final ApiClient _api;

  List<Product> _products(dynamic list) =>
      (list as List).map((e) => Product.fromJson(e as Map<String, dynamic>)).toList();

  @override
  Future<HomeFeed> home() async {
    final j = await _api.get<Map<String, dynamic>>('/home');
    return HomeFeed(
      categories: (j['categories'] as List).map((e) => Category.fromJson(e as Map<String, dynamic>)).toList(),
      dailyDeals: _products(j['dailyDeals']),
      trending: _products(j['trending']),
      newArrivals: _products(j['newArrivals']),
    );
  }

  @override
  Future<List<Category>> categories() async {
    final list = await _api.get<List<dynamic>>('/categories');
    return list.map((e) => Category.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<Paged<Product>> search(ProductQuery q, {int page = 1, int pageSize = 20}) async {
    final j = await _api.get<Map<String, dynamic>>('/products', query: {
      'q': (q.text?.trim().isEmpty ?? true) ? null : q.text!.trim(),
      'category': q.categorySlug,
      'minPrice': q.minPrice,
      'maxPrice': q.maxPrice,
      'condition': q.condition?.code,
      'freeShipping': q.freeShipping ? 'true' : null,
      'sort': q.sort.code,
      'page': page,
      'pageSize': pageSize,
    });
    return Paged.fromJson(j, Product.fromJson);
  }

  @override
  Future<Product> product(String id) async => Product.fromJson(await _api.get<Map<String, dynamic>>('/products/$id'));

  @override
  Future<List<Product>> similar(String id) async => _products(await _api.get<List<dynamic>>('/products/$id/similar'));
}
