import '../../../core/utils/formatters.dart';

enum ProductCondition {
  newItem('NEW', 'Brand New'),
  openBox('OPEN_BOX', 'Open Box'),
  refurbished('REFURBISHED', 'Refurbished'),
  used('USED', 'Pre-owned');

  const ProductCondition(this.code, this.label);
  final String code;
  final String label;

  static ProductCondition parse(String? code) =>
      values.firstWhere((c) => c.code == code, orElse: () => ProductCondition.newItem);
}

class ProductImage {
  const ProductImage({required this.id, required this.url, required this.position});
  final String id;
  final String url;
  final int position;

  factory ProductImage.fromJson(Map<String, dynamic> j) =>
      ProductImage(id: j['id'] as String, url: j['url'] as String, position: (j['position'] as num?)?.toInt() ?? 0);
}

/// A product as the app sees it. Pure Dart: no Flutter or HTTP types, so it can be
/// shared with a future Dart web/server client unchanged.
class Product {
  const Product({
    required this.id,
    required this.sku,
    required this.title,
    required this.price,
    this.mrp,
    this.brand,
    this.thumbnailUrl,
    this.condition = ProductCondition.newItem,
    this.freeShipping = true,
    this.rating = 0,
    this.reviewCount = 0,
    this.soldCount = 0,
    this.stock = 0,
    this.description = '',
    this.specs = const {},
    this.images = const [],
    this.categoryId,
    this.categoryName,
  });

  final String id;
  final String sku;
  final String title;
  final double price;
  final double? mrp;
  final String? brand;
  final String? thumbnailUrl;
  final ProductCondition condition;
  final bool freeShipping;
  final double rating;
  final int reviewCount;
  final int soldCount;
  final int stock;
  final String description;
  final Map<String, String> specs;
  final List<ProductImage> images;
  final String? categoryId;
  final String? categoryName;

  int? get discount => discountPercent(price, mrp);
  bool get inStock => stock > 0;
  List<String> get imageUrls =>
      images.isNotEmpty ? images.map((i) => i.url).toList() : [?thumbnailUrl];

  factory Product.fromJson(Map<String, dynamic> j) => Product(
        id: j['id'] as String,
        sku: (j['sku'] ?? '') as String,
        title: (j['title'] ?? '') as String,
        price: toDouble(j['price']),
        mrp: toDoubleOrNull(j['mrp']),
        brand: j['brand'] as String?,
        thumbnailUrl: j['thumbnailUrl'] as String?,
        condition: ProductCondition.parse(j['condition'] as String?),
        freeShipping: (j['freeShipping'] ?? true) as bool,
        rating: toDouble(j['rating'] ?? 0),
        reviewCount: (j['reviewCount'] as num?)?.toInt() ?? 0,
        soldCount: (j['soldCount'] as num?)?.toInt() ?? 0,
        stock: (j['stock'] as num?)?.toInt() ?? 0,
        description: (j['description'] ?? '') as String,
        specs: ((j['specs'] as Map?) ?? {}).map((k, v) => MapEntry('$k', '$v')),
        images: ((j['images'] as List?) ?? [])
            .map((e) => ProductImage.fromJson(e as Map<String, dynamic>))
            .toList()
          ..sort((a, b) => a.position.compareTo(b.position)),
        categoryId: j['categoryId'] as String?,
        categoryName: (j['category'] as Map?)?['name'] as String?,
      );
}
