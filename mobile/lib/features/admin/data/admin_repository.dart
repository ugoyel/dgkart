import 'package:cross_file/cross_file.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../orders/domain/order.dart';

class AdminStats {
  const AdminStats(this.raw);
  final Map<String, dynamic> raw;
  int get products => (raw['products'] as num).toInt();
  int get dummyProducts => (raw['dummyProducts'] as num).toInt();
  int get withoutImages => (raw['productsWithoutImages'] as num).toInt();
  int get users => (raw['users'] as num).toInt();
  int get orders => (raw['orders'] as num).toInt();
  double get revenue => (raw['revenue'] as num).toDouble();
  int get imageMappings => (raw['imageMappings'] as num).toInt();
}

class ImportJob {
  const ImportJob(this.raw);
  final Map<String, dynamic> raw;
  String get id => raw['id'] as String;
  String get type => raw['type'] as String;
  String get status => raw['status'] as String;
  String? get fileName => raw['fileName'] as String?;
  int get totalRows => (raw['totalRows'] as num).toInt();
  int get processedRows => (raw['processedRows'] as num).toInt();
  int get upsertedRows => (raw['upsertedRows'] as num).toInt();
  int get failedRows => (raw['failedRows'] as num).toInt();
  List<({int row, String message})> get errors => [
        for (final e in (raw['errors'] as List? ?? []))
          (row: ((e as Map)['row'] as num).toInt(), message: e['message'] as String),
      ];
  bool get isFinished => status == 'DONE' || status == 'FAILED';
  DateTime get createdAt => DateTime.parse(raw['createdAt'] as String);
}

class UploadReport {
  UploadReport() : matched = [], unmatched = [];
  final List<({String file, String sku})> matched;
  final List<({String file, String reason})> unmatched;

  void merge(Map<String, dynamic> j) {
    for (final m in j['matched'] as List) {
      matched.add((file: (m as Map)['file'] as String, sku: m['sku'] as String));
    }
    for (final u in j['unmatched'] as List) {
      unmatched.add((file: (u as Map)['file'] as String, reason: u['reason'] as String));
    }
  }
}

/// A picked file, independent of platform (streamed from disk on mobile, bytes on web).
class PickedFile {
  const PickedFile({required this.name, required this.file, required this.size});
  final String name;
  final XFile file;
  final int size;

  static Future<PickedFile> from(XFile f, String name) async => PickedFile(name: name, file: f, size: await f.length());

  Future<MultipartFile> toMultipart() async => !kIsWeb && file.path.isNotEmpty
      ? MultipartFile.fromFile(file.path, filename: name)
      : MultipartFile.fromBytes(await file.readAsBytes(), filename: name);
}

final adminRepositoryProvider = Provider<AdminRepository>((ref) => AdminRepository(ref.watch(apiClientProvider)));

class AdminRepository {
  AdminRepository(this._api);
  final ApiClient _api;

  Future<AdminStats> stats() async => AdminStats(await _api.get<Map<String, dynamic>>('/admin/stats'));

  Future<ImportJob> uploadSheet(String kind, PickedFile file, {void Function(double)? onProgress}) async {
    final form = FormData.fromMap({'file': await file.toMultipart()});
    final path = kind == 'products' ? '/admin/import/products' : '/admin/import/image-mapping';
    return ImportJob(await _api.upload<Map<String, dynamic>>(path, form,
        onProgress: (s, t) => onProgress?.call(t > 0 ? s / t : 0)));
  }

  Future<ImportJob> job(String id) async => ImportJob(await _api.get<Map<String, dynamic>>('/admin/jobs/$id'));

  Future<List<ImportJob>> jobs() async =>
      (await _api.get<List<dynamic>>('/admin/jobs')).map((e) => ImportJob(e as Map<String, dynamic>)).toList();

  /// Uploads images in batches so hundreds of files never block on one huge request.
  Future<UploadReport> uploadImages(List<PickedFile> files,
      {int batchSize = 10, void Function(int done, int total)? onProgress}) async {
    final report = UploadReport();
    for (var i = 0; i < files.length; i += batchSize) {
      final batch = files.sublist(i, (i + batchSize).clamp(0, files.length));
      final form = FormData();
      for (final f in batch) {
        form.files.add(MapEntry('files', await f.toMultipart()));
      }
      report.merge(await _api.upload<Map<String, dynamic>>('/admin/images', form));
      onProgress?.call(i + batch.length, files.length);
    }
    return report;
  }

  Future<ImportJob> seed(int count) async => ImportJob(await _api.post<Map<String, dynamic>>('/admin/seed', body: {'count': count}));

  Future<int> wipeDummy() async => ((await _api.delete<Map<String, dynamic>>('/admin/products/dummy'))['deleted'] as num).toInt();

  Future<int> wipeAll() async =>
      ((await _api.post<Map<String, dynamic>>('/admin/products/wipe-all', body: {'confirm': 'DELETE'}))['deleted'] as num).toInt();

  Future<List<Order>> orders({String? status}) async {
    final j = await _api.get<Map<String, dynamic>>('/admin/orders', query: {'status': status, 'pageSize': 100});
    return (j['items'] as List).map((e) => Order.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<void> setOrderStatus(String id, OrderStatus status) =>
      _api.patch<dynamic>('/admin/orders/$id/status', body: {'status': status.code});

  Future<void> deleteProduct(String id) => _api.delete<dynamic>('/admin/products/$id');
}

final adminStatsProvider = FutureProvider.autoDispose<AdminStats>((ref) => ref.watch(adminRepositoryProvider).stats());
final adminJobsProvider = FutureProvider.autoDispose<List<ImportJob>>((ref) => ref.watch(adminRepositoryProvider).jobs());
final adminOrdersProvider =
    FutureProvider.autoDispose<List<Order>>((ref) => ref.watch(adminRepositoryProvider).orders());
