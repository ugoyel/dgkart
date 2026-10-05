import 'package:dgkart/features/catalog/domain/product.dart';
import 'package:dgkart/features/orders/domain/order.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Product parses API json including numeric strings and sorted images', () {
    final p = Product.fromJson({
      'id': 'p1',
      'sku': 'DK-1',
      'title': 'Polo',
      'price': '499.00',
      'mrp': 999,
      'condition': 'REFURBISHED',
      'specs': {'Colour': 'Navy'},
      'images': [
        {'id': 'b', 'url': 'b.jpg', 'position': 1},
        {'id': 'a', 'url': 'a.jpg', 'position': 0},
      ],
    });
    expect(p.price, 499);
    expect(p.discount, 50);
    expect(p.condition, ProductCondition.refurbished);
    expect(p.imageUrls, ['a.jpg', 'b.jpg']);
  });

  test('Pricing matches backend shipping rules', () {
    expect(Pricing.of([(price: 100, qty: 2, freeShipping: false)]).total, 240);
    expect(Pricing.of([(price: 100, qty: 2, freeShipping: true)]).total, 200);
    expect(Pricing.of([(price: 250, qty: 2, freeShipping: false)]).shipping, 0);
  });
}
