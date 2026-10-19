class Category {
  const Category({required this.id, required this.slug, required this.name, this.imageUrl, this.parentId});

  final String id;
  final String slug;
  final String name;
  final String? imageUrl;
  final String? parentId;

  factory Category.fromJson(Map<String, dynamic> j) => Category(
        id: j['id'] as String,
        slug: j['slug'] as String,
        name: j['name'] as String,
        imageUrl: j['imageUrl'] as String?,
        parentId: j['parentId'] as String?,
      );
}
