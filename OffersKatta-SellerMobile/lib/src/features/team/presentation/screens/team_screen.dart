import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../brands/presentation/providers/brands_providers.dart';
import '../providers/team_providers.dart';

class TeamScreen extends ConsumerStatefulWidget {
  const TeamScreen({super.key});

  @override
  ConsumerState<TeamScreen> createState() => _TeamScreenState();
}

class _TeamScreenState extends ConsumerState<TeamScreen> {
  String? _brandId;

  @override
  Widget build(BuildContext context) {
    final brands = ref.watch(myBrandsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Team'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
      ),
      floatingActionButton: _brandId == null
          ? null
          : FloatingActionButton.extended(
              icon: const Icon(Icons.person_add_alt),
              label: const Text('Invite'),
              onPressed: () => _showInviteSheet(_brandId!),
            ),
      body: brands.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('$e')),
        data: (bs) {
          if (bs.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.group_outlined,
                        size: 64, color: Theme.of(context).colorScheme.outline),
                    const SizedBox(height: 12),
                    const Text('You need a brand first.'),
                    const SizedBox(height: 8),
                    OutlinedButton(
                      onPressed: () => context.go('/brands'),
                      child: const Text('Open brands'),
                    ),
                  ],
                ),
              ),
            );
          }
          _brandId ??= bs.first.id;
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                child: DropdownButtonFormField<String>(
                  value: _brandId,
                  decoration: const InputDecoration(labelText: 'Brand'),
                  items: bs
                      .map((b) => DropdownMenuItem(value: b.id, child: Text(b.name)))
                      .toList(),
                  onChanged: (v) => setState(() => _brandId = v),
                ),
              ),
              const Divider(height: 1),
              Expanded(child: _InvitationList(brandId: _brandId!)),
            ],
          );
        },
      ),
    );
  }

  Future<void> _showInviteSheet(String brandId) async {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
        child: _InviteSheet(brandId: brandId),
      ),
    );
    ref.invalidate(invitationsForBrandProvider(brandId));
  }
}

class _InvitationList extends ConsumerWidget {
  const _InvitationList({required this.brandId});
  final String brandId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invites = ref.watch(invitationsForBrandProvider(brandId));
    final df = DateFormat('yyyy-MM-dd');
    return invites.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('$e')),
      data: (items) {
        if (items.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.mail_outline,
                      size: 64, color: Theme.of(context).colorScheme.outline),
                  const SizedBox(height: 12),
                  const Text('No teammates invited yet.'),
                  const SizedBox(height: 6),
                  const Text(
                    'Tap "Invite" to send an email invitation.',
                    style: TextStyle(fontSize: 13),
                  ),
                ],
              ),
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(invitationsForBrandProvider(brandId)),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final inv = items[i];
              final Color statusColor = inv.status == 'ACCEPTED'
                  ? Colors.green
                  : inv.status == 'PENDING'
                      ? Colors.orange
                      : Colors.grey;
              return Card(
                child: ListTile(
                  leading: CircleAvatar(
                      child: Text(inv.email.substring(0, 1).toUpperCase())),
                  title: Text(inv.email,
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    '${inv.role.replaceAll('_', ' ').toLowerCase()} · expires ${df.format(inv.expiresAt)}',
                  ),
                  trailing: Chip(
                    label: Text(inv.status.toLowerCase(),
                        style: const TextStyle(fontSize: 11)),
                    backgroundColor: statusColor.withOpacity(0.15),
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              );
            },
          ),
        );
      },
    );
  }
}

class _InviteSheet extends ConsumerStatefulWidget {
  const _InviteSheet({required this.brandId});
  final String brandId;

  @override
  ConsumerState<_InviteSheet> createState() => _InviteSheetState();
}

class _InviteSheetState extends ConsumerState<_InviteSheet> {
  final _email = TextEditingController();
  String _role = 'BUSINESS_MANAGER';
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_email.text.contains('@')) {
      setState(() => _error = 'Enter a valid email');
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(teamRepositoryProvider).invite(
            brandId: widget.brandId,
            email: _email.text.trim(),
            role: _role,
          );
      if (mounted) Navigator.of(context).pop();
    } catch (e) {
      if (mounted) setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                    child: Text('Invite teammate',
                        style: Theme.of(context).textTheme.titleLarge)),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              autocorrect: false,
              decoration: const InputDecoration(
                labelText: 'Email',
                prefixIcon: Icon(Icons.mail_outline),
              ),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              value: _role,
              decoration: const InputDecoration(labelText: 'Role'),
              items: const [
                DropdownMenuItem(
                    value: 'BUSINESS_MANAGER', child: Text('Business manager')),
                DropdownMenuItem(value: 'STAFF', child: Text('Staff')),
              ],
              onChanged: (v) => setState(() => _role = v ?? 'BUSINESS_MANAGER'),
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
                  : const Text('Send invitation'),
            ),
          ],
        ),
      ),
    );
  }
}
