import '../../../core/utils/formatters.dart';
import '../../account/domain/address.dart';

enum PaymentMethod { online, cod }

enum OrderStatus {
  pendingPayment('PENDING_PAYMENT', 'Awaiting payment'),
  paid('PAID', 'Paid'),
  paymentFailed('PAYMENT_FAILED', 'Payment failed'),
  confirmedCod('CONFIRMED_COD', 'Confirmed (Cash on Delivery)'),
  shipped('SHIPPED', 'Shipped'),
  delivered('DELIVERED', 'Delivered'),
  cancelled('CANCELLED', 'Cancelled');

  const OrderStatus(this.code, this.label);
  final String code;
  final String label;

  static OrderStatus parse(String s) => values.firstWhere((v) => v.code == s, orElse: () => OrderStatus.pendingPayment);
}

class OrderLine {
  const OrderLine({required this.productId, required this.title, this.imageUrl, required this.unitPrice, required this.quantity});
  final String productId;
  final String title;
  final String? imageUrl;
  final double unitPrice;
  final int quantity;

  factory OrderLine.fromJson(Map<String, dynamic> j) => OrderLine(
        productId: j['productId'] as String,
        title: j['title'] as String,
        imageUrl: j['imageUrl'] as String?,
        unitPrice: toDouble(j['unitPrice']),
        quantity: (j['quantity'] as num).toInt(),
      );
}

class Order {
  const Order({
    required this.id,
    required this.orderNumber,
    required this.status,
    required this.paymentMethod,
    required this.items,
    required this.subtotal,
    required this.shippingFee,
    required this.total,
    required this.address,
    required this.createdAt,
    this.userId,
  });

  final String id;
  final String orderNumber;
  final OrderStatus status;
  final PaymentMethod paymentMethod;
  final List<OrderLine> items;
  final double subtotal;
  final double shippingFee;
  final double total;
  final Address address;
  final DateTime createdAt;
  final String? userId;

  bool get canPay => paymentMethod == PaymentMethod.online && status == OrderStatus.pendingPayment;

  factory Order.fromJson(Map<String, dynamic> j) => Order(
        id: j['id'] as String,
        orderNumber: j['orderNumber'] as String,
        status: OrderStatus.parse(j['status'] as String),
        paymentMethod: j['paymentMethod'] == 'COD' ? PaymentMethod.cod : PaymentMethod.online,
        items: (j['items'] as List).map((e) => OrderLine.fromJson(e as Map<String, dynamic>)).toList(),
        subtotal: toDouble(j['subtotal']),
        shippingFee: toDouble(j['shippingFee']),
        total: toDouble(j['total']),
        address: Address.fromJson(j['shippingAddress'] as Map<String, dynamic>),
        createdAt: DateTime.parse(j['createdAt'] as String),
        userId: j['userId'] as String?,
      );
}

/// Mirrors the backend's pricing rules so totals shown before ordering match.
class Pricing {
  static const freeShippingThreshold = 499.0;
  static const shippingFee = 40.0;

  static ({double subtotal, double shipping, double total}) of(List<({double price, int qty, bool freeShipping})> lines) {
    final subtotal = lines.fold<double>(0, (s, l) => s + l.price * l.qty);
    final allFree = lines.isNotEmpty && lines.every((l) => l.freeShipping);
    final shipping = lines.isEmpty || allFree || subtotal >= freeShippingThreshold ? 0.0 : shippingFee;
    return (subtotal: subtotal, shipping: shipping, total: subtotal + shipping);
  }
}

abstract class OrdersRepository {
  Future<Order> place({required Address address, required PaymentMethod method, List<({String productId, int quantity})>? items});
  Future<List<Order>> mine({int page = 1});
  Future<Order> get(String id);
}
