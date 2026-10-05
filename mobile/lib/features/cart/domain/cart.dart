import '../../../core/utils/formatters.dart';
import '../../catalog/domain/product.dart';

class CartLine {
  const CartLine({required this.product, required this.quantity});
  final Product product;
  final int quantity;
  double get lineTotal => product.price * quantity;
}

class Cart {
  const Cart({required this.lines, required this.count, required this.subtotal, required this.shippingFee, required this.total});
  const Cart.empty() : lines = const [], count = 0, subtotal = 0, shippingFee = 0, total = 0;

  final List<CartLine> lines;
  final int count;
  final double subtotal;
  final double shippingFee;
  final double total;

  bool get isEmpty => lines.isEmpty;

  factory Cart.fromJson(Map<String, dynamic> j) => Cart(
        lines: (j['items'] as List)
            .map((e) => CartLine(
                  product: Product.fromJson((e as Map<String, dynamic>)['product'] as Map<String, dynamic>),
                  quantity: (e['quantity'] as num).toInt(),
                ))
            .toList(),
        count: (j['count'] as num).toInt(),
        subtotal: toDouble(j['subtotal']),
        shippingFee: toDouble(j['shippingFee']),
        total: toDouble(j['total']),
      );
}

abstract class CartRepository {
  Future<Cart> get();
  Future<Cart> add(String productId, {int quantity = 1});
  Future<Cart> setQuantity(String productId, int quantity);
  Future<Cart> remove(String productId);
}
