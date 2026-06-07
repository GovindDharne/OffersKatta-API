import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/entities/brand.dart';
import '../providers/brands_providers.dart';

/// Bottom-sheet editor used for both create + edit.
/// Returns `true` from the sheet if the change was saved.
Future<bool?> showBrandEditSheet(BuildContext context, {Brand? existing}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    builder: (_) => Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: _BrandEditSheet(existing: existing),
    ),
  );
}

class _BrandEditSheet extends ConsumerStatefulWidget {
  const _BrandEditSheet({this.existing});
  final Brand? existing;

  @override
  ConsumerState<_BrandEditSheet> createState() => _BrandEditSheetState();
}

class _BrandEditSheetState extends ConsumerState<_BrandEditSheet> {
  late final TextEditingController _name;
  late final TextEditingController _description;
  late final TextEditingController _phone;
  late final TextEditingController _email;
  late final TextEditingController _website;
  String? _brandTypeId;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _name = TextEditingController(text: e?.name ?? '');
    _description = TextEditingController(text: e?.description ?? '');
    _phone = TextEditingController(text: e?.contactPhone ?? '');
    _email = TextEditingController(text: e?.contactEmail ?? '');
    _website = TextEditingController(text: e?.websiteUrl ?? '');
    _brandTypeId = e?.brandTypeId;
  }

  @override
  void dispose() {
    _name.dispose();
    _description.dispose();
    _phone.dispose();
    _email.dispose();
    _website.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      setState(() => _error = 'Brand name is required');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      final repo = ref.read(brandsRepositoryProvider);
      if (widget.existing == null) {
        await repo.create(
          name: _name.text.trim(),
          description: _description.text.trim(),
          contactPhone: _phone.text.trim(),
          contactEmail: _email.text.trim(),
          websiteUrl: _website.text.trim(),
          brandTypeId: _brandTypeId,
        );
      } else {
        await repo.update(widget.existing!.id, {
          'name': _name.text.trim(),
          'description': _description.text.trim(),
          'contactPhone': _phone.text.trim(),
          'contactEmail': _email.text.trim(),
          'websiteUrl': _website.text.trim(),
          if (_brandTypeId != null) 'brandTypeId': _brandTypeId,
        });
      }
      ref.invalidate(myBrandsProvider);
      if (mounted) Navigator.of(context).pop(true);
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final brandTypes = ref.watch(brandTypesProvider);
    final isEdit = widget.existing != null;
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      isEdit ? 'Edit brand' : 'New brand',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.of(context).pop(false),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _name,
                decoration: const InputDecoration(labelText: 'Name *'),
                textCapitalization: TextCapitalization.words,
              ),
              const SizedBox(height: 8),
              brandTypes.when(
                data: (types) => DropdownButtonFormField<String?>(
                  value: _brandTypeId,
                  decoration: const InputDecoration(labelText: 'Brand type'),
                  items: [
                    const DropdownMenuItem<String?>(value: null, child: Text('—')),
                    ...types.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name))),
                  ],
                  onChanged: (v) => setState(() => _brandTypeId = v),
                ),
                loading: () => const LinearProgressIndicator(),
                error: (_, __) => const SizedBox.shrink(),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _description,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Description'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Contact phone'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Contact email'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _website,
                keyboardType: TextInputType.url,
                decoration: const InputDecoration(labelText: 'Website URL'),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!,
                    style: TextStyle(
                        color: Theme.of(context).colorScheme.error, fontSize: 13)),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: _saving
                    ? const SizedBox(
                        height: 18,
                        width: 18,
                        child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(isEdit ? 'Save changes' : 'Create brand'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
