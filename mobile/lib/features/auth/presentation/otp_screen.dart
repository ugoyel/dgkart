import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/responsive.dart';
import '../domain/auth_repository.dart';
import 'auth_controller.dart';

class OtpScreen extends ConsumerStatefulWidget {
  const OtpScreen({super.key, required this.challenge, this.redirectTo});
  final OtpChallenge challenge;
  final String? redirectTo;

  @override
  ConsumerState<OtpScreen> createState() => _OtpScreenState();
}

class _OtpScreenState extends ConsumerState<OtpScreen> {
  final _code = TextEditingController();
  late OtpChallenge _challenge = widget.challenge;
  Timer? _timer;
  int _secondsLeft = 30;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _startTimer();
  }

  void _startTimer() {
    _timer?.cancel();
    setState(() => _secondsLeft = 30);
    _timer = Timer.periodic(const Duration(seconds: 1), (t) {
      if (_secondsLeft <= 1) t.cancel();
      if (mounted) setState(() => _secondsLeft--);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    _code.dispose();
    super.dispose();
  }

  Future<void> _verify() async {
    if (_code.text.length != 6 || _busy) return;
    setState(() => _busy = true);
    try {
      final user = await ref.read(authControllerProvider.notifier).verify(_challenge, _code.text);
      if (!mounted) return;
      showSnack(context, 'Welcome${user.name != null ? ', ${user.name}' : ''}!');
      context.go(widget.redirectTo ?? (user.isAdmin ? '/admin' : '/'));
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _resend() async {
    try {
      final mobile = _challenge.phone.replaceFirst('+91', '');
      _challenge = await ref.read(authControllerProvider.notifier).requestOtp(mobile, resendOf: _challenge);
      _startTimer();
      if (mounted) showSnack(context, 'OTP sent again');
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ContentWidth(
            maxWidth: 440,
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Text('Enter the code', style: Theme.of(context).textTheme.headlineSmall),
              const SizedBox(height: 8),
              Text('We sent a 6 digit code to ${_challenge.phone}', style: const TextStyle(color: DkColors.textMuted)),
              const SizedBox(height: 28),
              TextField(
                controller: _code,
                autofocus: true,
                keyboardType: TextInputType.number,
                autofillHints: const [AutofillHints.oneTimeCode],
                textAlign: TextAlign.center,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
                style: const TextStyle(fontSize: 28, letterSpacing: 14, fontWeight: FontWeight.w600),
                decoration: const InputDecoration(hintText: '••••••', counterText: ''),
                onChanged: (v) {
                  if (v.length == 6) _verify();
                },
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: _busy ? null : _verify,
                child: _busy
                    ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                    : const Text('Verify and continue'),
              ),
              const SizedBox(height: 12),
              Center(
                child: _secondsLeft > 0
                    ? Text('Resend code in ${_secondsLeft}s', style: const TextStyle(color: DkColors.textMuted))
                    : TextButton(onPressed: _resend, child: const Text('Resend code')),
              ),
              TextButton(onPressed: () => context.pop(), child: const Text('Change mobile number')),
            ]),
          ),
        ),
      ),
    );
  }
}
