import 'category.dart';
import 'paged.dart';
import 'product.dart';

enum SortOrder {
  best('best', 'Best Match'),
  priceAsc('price_asc', 'Price: lowest first'),
  priceDesc('price_desc', 'Price: highest first'),
  newest('newest', 'Newly listed');

  const SortOrder(this.code, this.label);
  final String code;
  final String label;
}

class ProductQuery {
  const ProductQuery({
    this.text,
    this.categorySlug,
    this.minPrice,
    this.maxPrice,
    this.condition,
    this.freeShipping = false,
    this.sort = SortOrder.best,
  });

  final String? text;
  final String? categorySlug;
  final double? minPrice;
  final double? maxPrice;
  final ProductCondition? condition;
  final bool freeShipping;
  final SortOrder sort;

  ProductQuery copyWith({
    String? text,
    String? categorySlug,
    double? minPrice,
    double? maxPrice,
    ProductCondition? condition,
    bool clearCondition = false,
    bool clearPrice = false,
    bool? freeShipping,
    SortOrder? sort,
  }) =>
      ProductQuery(
        text: text ?? this.text,
        categorySlug: categorySlug ?? this.categorySlug,
        minPrice: clearPrice ? null : (minPrice ?? this.minPrice),
        maxPrice: clearPrice ? null : (maxPrice ?? this.maxPrice),
        condition: clearCondition ? null : (condition ?? this.condition),
        freeShipping: freeShipping ?? this.freeShipping,
        sort: sort ?? this.sort,
      );

  @override
  bool operator ==(Object other) =>
      other is ProductQuery &&
      other.text == text &&
      other.categorySlug == categorySlug &&
      other.minPrice == minPrice &&
      other.maxPrice == maxPrice &&
      other.condition == condition &&
      other.freeShipping == freeShipping &&
      other.sort == sort;

  @override
  int get hashCode => Object.hash(text, categorySlug, minPrice, maxPrice, condition, freeShipping, sort);
}

class HomeFeed {
  const HomeFeed({required this.categories, required this.dailyDeals, required this.trending, required this.newArrivals});
  final List<Category> categories;
  final List<Product> dailyDeals;
  final List<Product> trending;
  final List<Product> newArrivals;
}

/// Port for catalogue data. The presentation layer only knows this interface.
abstract class CatalogRepository {
  Future<HomeFeed> home();
  Future<List<Category>> categories();
  Future<Paged<Product>> search(ProductQuery query, {int page = 1, int pageSize = 20});
  Future<Product> product(String id);
  Future<List<Product>> similar(String id);
}
