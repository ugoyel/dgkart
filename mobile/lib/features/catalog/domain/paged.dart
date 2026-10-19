class Paged<T> {
  const Paged({required this.items, required this.page, required this.total, required this.hasMore});

  final List<T> items;
  final int page;
  final int total;
  final bool hasMore;

  factory Paged.fromJson(Map<String, dynamic> j, T Function(Map<String, dynamic>) item) => Paged(
        items: (j['items'] as List).map((e) => item(e as Map<String, dynamic>)).toList(),
        page: (j['page'] as num).toInt(),
        total: (j['total'] as num).toInt(),
        hasMore: j['hasMore'] as bool,
      );
}
