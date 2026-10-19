import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/widgets/common.dart';
import '../../../core/widgets/responsive.dart';
import '../../auth/presentation/auth_controller.dart';
import '../domain/address.dart';

const indianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand',
  'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

/// Add or edit a delivery address; saves it to the profile and pops it back.
class AddressFormScreen extends ConsumerStatefulWidget {
  const AddressFormScreen({super.key, this.existing});
  final Address? existing;

  @override
  ConsumerState<AddressFormScreen> createState() => _AddressFormScreenState();
}

class _AddressFormScreenState extends ConsumerState<AddressFormScreen> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.existing?.name ?? ref.read(currentUserProvider)?.name);
  late final _phone = TextEditingController(
      text: widget.existing?.phone ?? ref.read(currentUserProvider)?.phone.replaceFirst('+91', ''));
  late final _line1 = TextEditingController(text: widget.existing?.line1);
  late final _line2 = TextEditingController(text: widget.existing?.line2);
  late final _city = TextEditingController(text: widget.existing?.city);
  late final _pincode = TextEditingController(text: widget.existing?.pincode);
  late String? _state = widget.existing?.state;
  late bool _default = widget.existing?.isDefault ?? true;
  bool _busy = false;

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _busy = true);
    final user = ref.read(currentUserProvider)!;
    final address = Address(
      id: widget.existing?.id ?? DateTime.now().microsecondsSinceEpoch.toString(),
      name: _name.text.trim(),
      phone: _phone.text.trim(),
      line1: _line1.text.trim(),
      line2: _line2.text.trim(),
      city: _city.text.trim(),
      state: _state!,
      pincode: _pincode.text.trim(),
      isDefault: _default,
    );
    final others = user.addresses
        .where((a) => a.id != address.id)
        .map((a) => _default ? Address.fromJson({...a.toJson(), 'isDefault': false}) : a)
        .toList();
    try {
      await ref.read(authControllerProvider.notifier).saveAddresses([address, ...others]);
      if (mounted) context.pop(address);
    } catch (e) {
      if (mounted) showSnack(context, e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  String? _req(String? v) => (v == null || v.trim().isEmpty) ? 'Required' : null;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.existing == null ? 'Add address' : 'Edit address')),
      body: Form(
        key: _form,
        child: ContentWidth(
          maxWidth: 600,
          child: ListView(padding: const EdgeInsets.all(16), children: [
            TextFormField(controller: _name, decoration: const InputDecoration(labelText: 'Full name'), validator: _req),
            const SizedBox(height: 12),
            TextFormField(
              controller: _phone,
              keyboardType: TextInputType.phone,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(10)],
              decoration: const InputDecoration(labelText: 'Mobile number', prefixText: '+91 '),
              validator: (v) => RegExp(r'^[6-9]\d{9}$').hasMatch(v ?? '') ? null : 'Enter a valid mobile number',
            ),
            const SizedBox(height: 12),
            TextFormField(controller: _line1, decoration: const InputDecoration(labelText: 'Flat, house no., building, street'), validator: _req),
            const SizedBox(height: 12),
            TextFormField(controller: _line2, decoration: const InputDecoration(labelText: 'Area, landmark (optional)')),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(child: TextFormField(controller: _city, decoration: const InputDecoration(labelText: 'City'), validator: _req)),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  controller: _pincode,
                  keyboardType: TextInputType.number,
                  inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
                  decoration: const InputDecoration(labelText: 'PIN code'),
                  validator: (v) => RegExp(r'^\d{6}$').hasMatch(v ?? '') ? null : '6 digits',
                ),
              ),
            ]),
            const SizedBox(height: 12),
            DropdownButtonFormField<String>(
              initialValue: _state,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'State'),
              items: [for (final s in indianStates) DropdownMenuItem(value: s, child: Text(s))],
              onChanged: (v) => setState(() => _state = v),
              validator: (v) => v == null ? 'Select a state' : null,
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              value: _default,
              onChanged: (v) => setState(() => _default = v),
              title: const Text('Make this my default address'),
            ),
            const SizedBox(height: 12),
            FilledButton(onPressed: _busy ? null : _save, child: const Text('Save address')),
          ]),
        ),
      ),
    );
  }
}
