import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/branch.dart';
import '../providers/branches_providers.dart';

const _statuses = ['ACTIVE', 'INACTIVE', 'COMING_SOON', 'CLOSED'];

Future<bool?> showBranchEditSheet(
  BuildContext context, {
  required String brandId,
  BusinessBranch? existing,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _BranchEditSheet(brandId: brandId, existing: existing),
  );
}

class _BranchEditSheet extends ConsumerStatefulWidget {
  const _BranchEditSheet({required this.brandId, this.existing});
  final String brandId;
  final BusinessBranch? existing;

  @override
  ConsumerState<_BranchEditSheet> createState() => _BranchEditSheetState();
}

class _BranchEditSheetState extends ConsumerState<_BranchEditSheet> {
  late final TextEditingController _name;
  late final TextEditingController _addr1;
  late final TextEditingController _addr2;
  late final TextEditingController _city;
  late final TextEditingController _state;
  late final TextEditingController _country;
  late final TextEditingController _postal;
  late final TextEditingController _lat;
  late final TextEditingController _lng;
  late final TextEditingController _phone;
  late final TextEditingController _email;
  String _status = 'ACTIVE';
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _name    = TextEditingController(text: e?.name ?? '');
    _addr1   = TextEditingController(text: e?.addressLine1 ?? '');
    _addr2   = TextEditingController(text: e?.addressLine2 ?? '');
    _city    = TextEditingController(text: e?.city ?? '');
    _state   = TextEditingController(text: e?.state ?? '');
    _country = TextEditingController(text: e?.country ?? 'India');
    _postal  = TextEditingController(text: e?.postalCode ?? '');
    _lat     = TextEditingController(text: e?.latitude.toString() ?? '');
    _lng     = TextEditingController(text: e?.longitude.toString() ?? '');
    _phone   = TextEditingController(text: e?.phone ?? '');
    _email   = TextEditingController(text: e?.email ?? '');
    _status  = e?.status ?? 'ACTIVE';
  }

  @override
  void dispose() {
    for (final c in [_name, _addr1, _addr2, _city, _state, _country, _postal, _lat, _lng, _phone, _email]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _save() async {
    final lat = double.tryParse(_lat.text.trim());
    final lng = double.tryParse(_lng.text.trim());
    if (_name.text.trim().isEmpty || _addr1.text.trim().isEmpty || _city.text.trim().isEmpty ||
        _state.text.trim().isEmpty || _postal.text.trim().isEmpty || lat == null || lng == null) {
      setState(() => _error = 'Fill all required fields (marked *) and use numeric lat/lng.');
      return;
    }
    setState(() { _saving = true; _error = null; });
    try {
      // Build the shared payload. `status` is only accepted on UPDATE — the
      // CreateBranchDto rejects it (forbidNonWhitelisted), so we add it
      // conditionally below.
      final body = <String, dynamic>{
        'brandId': widget.brandId,
        'name': _name.text.trim(),
        'addressLine1': _addr1.text.trim(),
        if (_addr2.text.trim().isNotEmpty) 'addressLine2': _addr2.text.trim(),
        'city': _city.text.trim(),
        'state': _state.text.trim(),
        'country': _country.text.trim(),
        'postalCode': _postal.text.trim(),
        'latitude': lat,
        'longitude': lng,
        if (_phone.text.trim().isNotEmpty) 'phone': _phone.text.trim(),
        if (_email.text.trim().isNotEmpty) 'email': _email.text.trim(),
      };
      final repo = ref.read(branchesRepositoryProvider);
      if (widget.existing == null) {
        await repo.create(body);
      } else {
        // brandId is immutable in update; status is only valid on update.
        body.remove('brandId');
        body['status'] = _status;
        await repo.update(widget.existing!.id, body);
      }
      ref.invalidate(branchesForBrandProvider(widget.brandId));
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.existing != null;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottomInset),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                      child: Text(isEdit ? 'Edit branch' : 'New branch',
                          style: Theme.of(context).textTheme.titleLarge)),
                  IconButton(
                      icon: const Icon(Icons.close),
                      onPressed: () => Navigator.of(context).pop(false)),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Branch name *'),
                textCapitalization: TextCapitalization.words,
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _addr1,
                decoration: const InputDecoration(labelText: 'Address line 1 *'),
                textCapitalization: TextCapitalization.words,
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _addr2,
                decoration: const InputDecoration(labelText: 'Address line 2'),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _city,
                      decoration: const InputDecoration(labelText: 'City *'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _state,
                      decoration: const InputDecoration(labelText: 'State *'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _postal,
                      decoration: const InputDecoration(labelText: 'PIN code *'),
                      keyboardType: TextInputType.number,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _country,
                      decoration: const InputDecoration(labelText: 'Country *'),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _lat,
                      decoration: const InputDecoration(labelText: 'Latitude *', hintText: 'e.g. 19.0760'),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.\-]'))],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _lng,
                      decoration: const InputDecoration(labelText: 'Longitude *', hintText: 'e.g. 72.8777'),
                      keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                      inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'[\d.\-]'))],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Phone'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email'),
              ),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _status,
                decoration: const InputDecoration(labelText: 'Status'),
                items: _statuses
                    .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                    .toList(growable: false),
                onChanged: (v) => setState(() => _status = v ?? 'ACTIVE'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error, fontSize: 13)),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(isEdit ? 'Save changes' : 'Create branch'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
