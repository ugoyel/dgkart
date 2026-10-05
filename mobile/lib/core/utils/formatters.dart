import 'package:intl/intl.dart';

final _inr = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
final _inr2 = NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 2);
final _compact = NumberFormat.compact(locale: 'en_IN');

String formatPrice(num value) => value == value.roundToDouble() ? _inr.format(value) : _inr2.format(value);
String formatCompact(num value) => _compact.format(value);
String formatDate(DateTime d) => DateFormat('d MMM yyyy').format(d.toLocal());

int? discountPercent(num price, num? mrp) {
  if (mrp == null || mrp <= price || mrp == 0) return null;
  return (((mrp - price) / mrp) * 100).round();
}

double toDouble(dynamic v) => v is num ? v.toDouble() : double.tryParse('$v') ?? 0;
double? toDoubleOrNull(dynamic v) => v == null ? null : toDouble(v);
