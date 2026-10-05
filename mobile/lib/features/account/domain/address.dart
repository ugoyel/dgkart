class Address {
  const Address({
    required this.id,
    required this.name,
    required this.phone,
    required this.line1,
    this.line2,
    required this.city,
    required this.state,
    required this.pincode,
    this.isDefault = false,
  });

  final String id;
  final String name;
  final String phone;
  final String line1;
  final String? line2;
  final String city;
  final String state;
  final String pincode;
  final bool isDefault;

  String get singleLine => [line1, if (line2?.isNotEmpty ?? false) line2, city, '$state $pincode'].join(', ');

  factory Address.fromJson(Map<String, dynamic> j) => Address(
        id: j['id'] as String,
        name: j['name'] as String,
        phone: j['phone'] as String,
        line1: j['line1'] as String,
        line2: j['line2'] as String?,
        city: j['city'] as String,
        state: j['state'] as String,
        pincode: j['pincode'] as String,
        isDefault: (j['isDefault'] ?? false) as bool,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'phone': phone,
        'line1': line1,
        if (line2 != null && line2!.isNotEmpty) 'line2': line2,
        'city': city,
        'state': state,
        'pincode': pincode,
        'isDefault': isDefault,
      };
}
