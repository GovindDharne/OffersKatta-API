import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/constants/api_constants.dart';
import '../../../../core/di/providers.dart';
import '../../../../core/utils/formatters.dart';

class FollowedBrand {
  const FollowedBrand({
    required this.id,
    required this.name,
    this.logoUrl,
    this.businessType,
    this.isVerified = false,
  });

  factory FollowedBrand.fromFollowRow(Map<String, dynamic> row) {
    final brand = (row['brand'] as Map<String, dynamic>?) ?? const {};
    return FollowedBrand(
      id: brand['id'] as String? ?? '',
      name: brand['name'] as String? ?? 'Brand',
      logoUrl: brand['logoUrl'] as String?,
      businessType: brand['businessType'] as String?,
      isVerified: brand['isVerified'] as bool? ?? false,
    );
  }

  final String id;
  final String name;
  final String? logoUrl;
  final String? businessType;
  final bool isVerified;
}

/// Brands the signed-in customer follows. /brands/me/follows returns the
/// BrandFollow rows with the nested brand. Unfollow hits DELETE
/// /brands/:id/follow and refreshes the list.
final myFollowsProvider = FutureProvider.autoDispose<List<FollowedBrand>>((ref) async {
  final api = ref.watch(apiClientProvider);
  final rows = await api.get<List<dynamic>>(
    ApiConstants.brandsMeFollows,
    decode: (raw) => (raw as List<dynamic>?) ?? const [],
  );
  return rows
      .map((e) => FollowedBrand.fromFollowRow(e as Map<String, dynamic>))
      .where((b) => b.id.isNotEmpty)
      .toList(growable: false);
});

class MyFollowsScreen extends ConsumerWidget {
  const MyFollowsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final followsAsync = ref.watch(myFollowsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Brands you follow')),
      body: followsAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.error_outline, size: 40),
                const SizedBox(height: 12),
                Text('Could not load follows.\n$e', textAlign: TextAlign.center),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed: () => ref.invalidate(myFollowsProvider),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (brands) {
          if (brands.isEmpty) {
            return const _EmptyFollows();
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(myFollowsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 8),
              itemCount: brands.length,
              separatorBuilder: (_, __) => const Divider(height: 1),
              itemBuilder: (context, i) => _FollowRow(brand: brands[i]),
            ),
          );
        },
      ),
    );
  }
}

class _FollowRow extends ConsumerStatefulWidget {
  const _FollowRow({required this.brand});
  final FollowedBrand brand;

  @override
  ConsumerState<_FollowRow> createState() => _FollowRowState();
}

class _FollowRowState extends ConsumerState<_FollowRow> {
  bool _busy = false;

  Future<void> _unfollow() async {
    setState(() => _busy = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.delete<void>(ApiConstants.brandFollow(widget.brand.id));
      ref.invalidate(myFollowsProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Unfollowed ${widget.brand.name}.')),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _busy = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not unfollow: $e')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final b = widget.brand;
    return ListTile(
      leading: CircleAvatar(
        backgroundColor: scheme.primaryContainer,
        backgroundImage: (b.logoUrl != null && b.logoUrl!.isNotEmpty)
            ? NetworkImage(resolveAssetUrl(b.logoUrl)!)
            : null,
        child: (b.logoUrl == null || b.logoUrl!.isEmpty)
            ? Text(b.name.characters.first.toUpperCase())
            : null,
      ),
      title: Row(
        children: [
          Flexible(child: Text(b.name, overflow: TextOverflow.ellipsis)),
          if (b.isVerified) ...[
            const SizedBox(width: 4),
            Icon(Icons.verified, size: 16, color: scheme.primary),
          ],
        ],
      ),
      subtitle: b.businessType != null
          ? Text(b.businessType!.replaceAll('_', ' ').toLowerCase())
          : null,
      trailing: _busy
          ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
          : OutlinedButton(
              onPressed: _unfollow,
              child: const Text('Unfollow'),
            ),
    );
  }
}

class _EmptyFollows extends StatelessWidget {
  const _EmptyFollows();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.favorite_border, size: 48, color: Theme.of(context).colorScheme.onSurfaceVariant),
            const SizedBox(height: 12),
            const Text(
              'You\'re not following any brands yet.\nFollow a brand from an offer to get its new deals.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
