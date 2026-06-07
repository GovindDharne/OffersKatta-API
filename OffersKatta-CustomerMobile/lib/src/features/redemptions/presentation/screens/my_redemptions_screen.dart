import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/utils/formatters.dart';
import '../providers/redemptions_providers.dart';

class MyRedemptionsScreen extends ConsumerWidget {
  const MyRedemptionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(myRedemptionsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Your redemptions')),
      body: list.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Could not load: $e')),
        data: (items) {
          if (items.isEmpty) {
            return const Center(child: Text('No redemptions yet.'));
          }
          return RefreshIndicator(
            onRefresh: () async => ref.invalidate(myRedemptionsProvider),
            child: ListView.separated(
              padding: const EdgeInsets.all(12),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (_, i) {
                final r = items[i];
                return Card(
                  child: ListTile(
                    title: Text(r.offerTitle ?? r.offerId),
                    subtitle: Text(
                      [
                        r.branchName,
                        'expires ${formatDate(r.expiresAt)}',
                      ].where((s) => s != null && s.isNotEmpty).join(' · '),
                    ),
                    trailing: _StatusChip(status: r.status),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final (bg, fg) = switch (status) {
      'REDEEMED' => (Colors.green.shade100, Colors.green.shade900),
      'PENDING' => (scheme.secondaryContainer, scheme.onSecondaryContainer),
      'EXPIRED' || 'CANCELLED' => (scheme.errorContainer, scheme.onErrorContainer),
      _ => (scheme.surfaceContainerHighest, scheme.onSurface),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(999)),
      child: Text(status.toLowerCase(), style: TextStyle(color: fg, fontWeight: FontWeight.w600, fontSize: 12)),
    );
  }
}
