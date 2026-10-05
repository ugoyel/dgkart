import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/config/app_config.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/common.dart';
import '../../../core/widgets/dk_logo.dart';
import '../../../core/widgets/responsive.dart';
import 'auth_controller.dart';

/// "Sign in or create an account" with a mobile number. One flow for both:
/// new numbers are registered automatically after OTP verification.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key, this.redirectTo});
  final String? redirectTo;

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phone = TextEditingController();
  final _form = GlobalKey<FormState>();
  bool _busy = false;

  @override
  void dispose() {
    _phone.dispose();
    super.dispose();
  }

  Future<void> _continue() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    try {
      final challenge = await ref.read(authControllerProvider.notifier).requestOtp(_phone.text);
      if (!mounted) return;
      context.push('/otp', extra: {'challenge': challenge, 'redirectTo': widget.redirectTo});
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(leading: const CloseButton()),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: ContentWidth(
            maxWidth: 440,
            child: Form(
              key: _form,
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                const Center(child: DkLogo(size: 40)),
                const SizedBox(height: 28),
                Text('Sign in or create an account',
                    textAlign: TextAlign.center, style: Theme.of(context).textTheme.headlineSmall?.copyWith(fontSize: 22)),
                const SizedBox(height: 8),
                const Text('We will send a one-time password to your mobile number.',
                    textAlign: TextAlign.center, style: TextStyle(color: DkColors.textMuted)),
                const SizedBox(height: 28),
                TextFormField(
                  controller: _phone,
                  autofocus: true,
                  keyboardType: TextInputType.phone,
                  autofillHints: const [AutofillHints.telephoneNumberNational],
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
                  style: const TextStyle(fontSize: 18, letterSpacing: 1),
                  decoration: const InputDecoration(
                    labelText: 'Mobile number',
                    prefixText: '+91  ',
                    counterText: '',
                  ),
                  validator: (v) => RegExp(r'^[6-9]\d{9}$').hasMatch(v ?? '') ? null : 'Enter a valid 10 digit mobile number',
                  onFieldSubmitted: (_) => _continue(),
                ),
                const SizedBox(height: 20),
                FilledButton(
                  onPressed: _busy ? null : _continue,
                  child: _busy
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                      : const Text('Continue'),
                ),
                if (!AppConfig.useFirebase) ...[
                  const SizedBox(height: 16),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(color: DkColors.surface, borderRadius: BorderRadius.circular(8)),
                    child: const Text('Test mode: no SMS is sent. Use OTP 123456.',
                        textAlign: TextAlign.center, style: TextStyle(fontSize: 13, color: DkColors.textMuted)),
                  ),
                ],
                const SizedBox(height: 24),
                Text.rich(
                  TextSpan(children: [
                    const TextSpan(text: 'By continuing, you agree to the DGkart '),
                    TextSpan(text: 'User Agreement', style: TextStyle(color: Theme.of(context).colorScheme.primary)),
                    const TextSpan(text: ' and '),
                    TextSpan(text: 'Privacy Notice', style: TextStyle(color: Theme.of(context).colorScheme.primary)),
                    const TextSpan(text: '.'),
                  ]),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 12, color: DkColors.textMuted),
                ),
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
