import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../data/admin_repository.dart';

/// Polls an import/seed job and renders live progress plus row errors.
class JobProgressView extends ConsumerStatefulWidget {
  const JobProgressView({super.key, required this.initial, this.onFinished});
  final ImportJob initial;
  final ValueChanged<ImportJob>? onFinished;

  @override
  ConsumerState<JobProgressView> createState() => _JobProgressViewState();
}

class _JobProgressViewState extends ConsumerState<JobProgressView> {
  late ImportJob _job = widget.initial;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 800), (_) => _poll());
  }

  Future<void> _poll() async {
    try {
      final j = await ref.read(adminRepositoryProvider).job(_job.id);
      if (!mounted) return;
      setState(() => _job = j);
      if (j.isFinished) {
        _timer?.cancel();
        widget.onFinished?.call(j);
      }
    } catch (_) {/* keep polling */}
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final j = _job;
    final value = j.isFinished ? 1.0 : (j.totalRows > 0 ? j.processedRows / j.totalRows : null);
    final color = j.status == 'FAILED' ? DkColors.deal : (j.isFinished ? DkColors.success : DkColors.primary);
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, mainAxisSize: MainAxisSize.min, children: [
      Row(children: [
        Icon(j.isFinished ? (j.status == 'DONE' ? Icons.check_circle : Icons.error) : Icons.sync, color: color),
        const SizedBox(width: 8),
        Text(switch (j.status) { 'DONE' => 'Completed', 'FAILED' => 'Failed', 'RUNNING' => 'Processing…', _ => 'Queued…' },
            style: TextStyle(fontWeight: FontWeight.w700, color: color)),
      ]),
      const SizedBox(height: 10),
      LinearProgressIndicator(value: value, color: color, minHeight: 6, borderRadius: BorderRadius.circular(3)),
      const SizedBox(height: 10),
      Text('${j.upsertedRows} saved • ${j.failedRows} skipped${j.totalRows > 0 ? ' • ${j.totalRows} rows' : ''}'),
      if (j.errors.isNotEmpty) ...[
        const SizedBox(height: 12),
        const Text('Rows that need fixing', style: TextStyle(fontWeight: FontWeight.w700)),
        const SizedBox(height: 4),
        ConstrainedBox(
          constraints: const BoxConstraints(maxHeight: 240),
          child: ListView(shrinkWrap: true, children: [
            for (final e in j.errors)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Text(e.row > 0 ? 'Row ${e.row}: ${e.message}' : e.message,
                    style: const TextStyle(color: DkColors.deal, fontSize: 13)),
              ),
          ]),
        ),
      ],
    ]);
  }
}

Future<void> showJobDialog(BuildContext context, WidgetRef ref, ImportJob job, {required String title}) => showDialog<void>(
      context: context,
      builder: (_) => AlertDialog(
        title: Text(title),
        content: SizedBox(width: 420, child: JobProgressView(initial: job)),
        actions: [TextButton(onPressed: () => Navigator.pop(context), child: const Text('Close'))],
      ),
    );
