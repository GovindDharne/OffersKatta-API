import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../brands/presentation/providers/brands_providers.dart';
import '../providers/branches_providers.dart';
import 'branch_edit_sheet.dart';

class BranchesScreen extends ConsumerStatefulWidget {
  const BranchesScreen({super.key});

  @override
  ConsumerState<BranchesScreen> createState() => _BranchesScreenState();
}

class _BranchesScreenState extends ConsumerState<BranchesScreen> {
  String? _brandId;

  @override
  Widget build(BuildContext context) {
    final brands = ref.watch(myBrandsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Branches'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
      ),
      floatingActionButton: _brandId == null
          ? null
          : FloatingActionButton.extended(
              icon: const Icon(Icons.add),
              label: const Text('New branch'),
              onPressed: () => showBranchEditSheet(context, brandId: _brandId!),
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
                    Icon(Icons.store_outlined,
                        size: 64, color: Theme.of(context).colorScheme.outline),
                    const SizedBox(height: 12),
                    const Text('You need a brand first.',
                        style: TextStyle(fontWeight: FontWeight.w600)),
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
          // Default selection: first brand.
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
                      .toList(growable: false),
                  onChanged: (v) => setState(() => _brandId = v),
                ),
              ),
              const Divider(height: 1),
              Expanded(child: _BranchList(brandId: _brandId!)),
            ],
          );
        },
      ),
    );
  }
}

class _BranchList extends ConsumerWidget {
  const _BranchList({required this.brandId});
  final String brandId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branches = ref.watch(branchesForBrandProvider(brandId));
    return branches.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('$e', textAlign: TextAlign.center),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => ref.invalidate(branchesForBrandProvider(brandId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return Center(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.store_mall_directory_outlined,
                      size: 64, color: Theme.of(context).colorScheme.outline),
                  const SizedBox(height: 12),
                  const Text('No branches yet for this brand.'),
                ],
              ),
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(branchesForBrandProvider(brandId)),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final b = items[i];
              return Card(
                child: ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.storefront_outlined)),
                  title: Text(b.name, style: const TextStyle(fontWeight: FontWeight.w600)),
                  subtitle: Text(
                    '${b.addressLine1}, ${b.city} — ${b.status.toLowerCase()}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: PopupMenuButton<String>(
                    onSelected: (v) async {
                      if (v == 'edit') {
                        await showBranchEditSheet(context, brandId: brandId, existing: b);
                      } else if (v == 'delete') {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (_) => AlertDialog(
                            title: const Text('Delete branch?'),
                            content: Text('"${b.name}" will be archived.'),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.of(context).pop(false),
                                  child: const Text('Cancel')),
                              FilledButton.tonal(
                                  style: FilledButton.styleFrom(
                                      foregroundColor:
                                          Theme.of(context).colorScheme.error),
                                  onPressed: () => Navigator.of(context).pop(true),
                                  child: const Text('Delete')),
                            ],
                          ),
                        );
                        if (ok == true) {
                          try {
                            await ref.read(branchesRepositoryProvider).delete(b.id);
                            ref.invalidate(branchesForBrandProvider(brandId));
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Delete failed: $e')),
                              );
                            }
                          }
                        }
                      }
                    },
                    itemBuilder: (_) => const [
                      PopupMenuItem(value: 'edit', child: Text('Edit')),
                      PopupMenuItem(value: 'delete', child: Text('Delete')),
                    ],
                  ),
                  onTap: () =>
                      showBranchEditSheet(context, brandId: brandId, existing: b),
                ),
              );
            },
          ),
        );
      },
    );
  }
}
