import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../branches/presentation/providers/branches_providers.dart';
import '../../../brands/presentation/providers/brands_providers.dart';
import '../../data/models/redemption_models.dart';
import '../providers/redemptions_providers.dart';

/// "Redemptions" — per-branch log of who scanned what, when. Sellers use this
/// to reconcile day-of-counter activity and to spot trends ("X offer is being
/// claimed 10×/day, bump it featured"). Filter is brand → branch since the
/// backend keys redemptions by branchId.
class RedemptionsScreen extends ConsumerStatefulWidget {
  const RedemptionsScreen({super.key});

  @override
  ConsumerState<RedemptionsScreen> createState() => _RedemptionsScreenState();
}

class _RedemptionsScreenState extends ConsumerState<RedemptionsScreen> {
  String? _brandId;
  String? _branchId;

  @override
  Widget build(BuildContext context) {
    final brands = ref.watch(myBrandsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Redemptions'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
        actions: [
          if (_branchId != null)
            IconButton(
              tooltip: 'Refresh',
              icon: const Icon(Icons.refresh),
              onPressed: () => ref.invalidate(branchRedemptionsProvider(_branchId!)),
            ),
        ],
      ),
      body: brands.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Padding(padding: const EdgeInsets.all(24), child: Text('$e'))),
        data: (bs) {
          if (bs.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.qr_code_2,
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
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                child: DropdownButtonFormField<String>(
                  value: _brandId,
                  decoration: const InputDecoration(labelText: 'Brand'),
                  items: bs
                      .map((b) => DropdownMenuItem(value: b.id, child: Text(b.name)))
                      .toList(growable: false),
                  onChanged: (v) => setState(() {
                    _brandId = v;
                    _branchId = null;
                  }),
                ),
              ),
              if (_brandId != null) _BranchPicker(
                brandId: _brandId!,
                selectedId: _branchId,
                onChanged: (id) => setState(() => _branchId = id),
              ),
              const Divider(height: 1),
              Expanded(
                child: _branchId == null
                    ? const _Empty(message: 'Pick a branch to see its redemptions.')
                    : _RedemptionsList(branchId: _branchId!),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _BranchPicker extends ConsumerWidget {
  const _BranchPicker({
    required this.brandId,
    required this.selectedId,
    required this.onChanged,
  });
  final String brandId;
  final String? selectedId;
  final ValueChanged<String?> onChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branches = ref.watch(branchesForBrandProvider(brandId));
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
      child: branches.when(
        loading: () => const LinearProgressIndicator(),
        error: (e, _) => Text('Could not load branches: $e'),
        data: (bs) {
          if (bs.isEmpty) {
            return const Text('No branches under this brand yet.',
                style: TextStyle(color: Colors.grey, fontSize: 13));
          }
          // Auto-select the first branch the first time a brand resolves.
          if (selectedId == null && bs.isNotEmpty) {
            WidgetsBinding.instance.addPostFrameCallback((_) => onChanged(bs.first.id));
          }
          return DropdownButtonFormField<String>(
            value: selectedId,
            decoration: const InputDecoration(labelText: 'Branch'),
            items: bs
                .map((b) => DropdownMenuItem(value: b.id, child: Text(b.name)))
                .toList(growable: false),
            onChanged: onChanged,
          );
        },
      ),
    );
  }
}

class _RedemptionsList extends ConsumerWidget {
  const _RedemptionsList({required this.branchId});
  final String branchId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final list = ref.watch(branchRedemptionsProvider(branchId));
    return list.when(
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
                onPressed: () => ref.invalidate(branchRedemptionsProvider(branchId)),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (items) {
        if (items.isEmpty) {
          return const _Empty(message: 'No redemptions yet at this branch.');
        }
        // Totals computed from the loaded page. For lifetime totals we'd add
        // a /stats endpoint server-side; this page-level summary is enough
        // to spot today's activity at a glance.
        final now = DateTime.now();
        final today = items.where((r) =>
            r.redeemedAt != null &&
            r.redeemedAt!.year == now.year &&
            r.redeemedAt!.month == now.month &&
            r.redeemedAt!.day == now.day).length;
        final redeemed = items.where((r) => r.isRedeemed).length;
        final pending = items.where((r) => r.isPending).length;
        final totalSales = items
            .where((r) => r.isRedeemed && r.finalAmount != null)
            .fold<num>(0, (acc, r) => acc + (r.finalAmount ?? 0));
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(branchRedemptionsProvider(branchId)),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 24),
            itemCount: items.length + 1,
            separatorBuilder: (_, __) => const SizedBox(height: 6),
            itemBuilder: (_, i) {
              if (i == 0) {
                return _SummaryStrip(
                  today: today,
                  redeemed: redeemed,
                  pending: pending,
                  totalSales: totalSales,
                );
              }
              return _RedemptionRow(r: items[i - 1]);
            },
          ),
        );
      },
    );
  }
}

class _SummaryStrip extends StatelessWidget {
  const _SummaryStrip({
    required this.today,
    required this.redeemed,
    required this.pending,
    required this.totalSales,
  });
  final int today;
  final int redeemed;
  final int pending;
  final num totalSales;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final money =
        NumberFormat.currency(locale: 'en_IN', symbol: '₹', decimalDigits: 0);
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Expanded(child: _Stat(label: 'Today', value: '$today')),
            Container(
                width: 1,
                height: 36,
                color: scheme.outlineVariant,
                margin: const EdgeInsets.symmetric(horizontal: 4)),
            Expanded(child: _Stat(label: 'Redeemed', value: '$redeemed')),
            Container(
                width: 1,
                height: 36,
                color: scheme.outlineVariant,
                margin: const EdgeInsets.symmetric(horizontal: 4)),
            Expanded(child: _Stat(label: 'Pending', value: '$pending')),
            Container(
                width: 1,
                height: 36,
                color: scheme.outlineVariant,
                margin: const EdgeInsets.symmetric(horizontal: 4)),
            Expanded(child: _Stat(label: 'Sales', value: money.format(totalSales))),
          ],
        ),
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(value,
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: Colors.grey)),
      ],
    );
  }
}

class _RedemptionRow extends StatelessWidget {
  const _RedemptionRow({required this.r});
  final RedemptionInfo r;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final when = r.redeemedAt ?? r.expiresAt;
    final dateLabel = DateFormat('d MMM, HH:mm').format(when.toLocal());
    return Card(
      child: ListTile(
        leading: _StatusAvatar(status: r.status),
        title: Text(
          r.offerTitle ?? 'Offer',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: const TextStyle(fontWeight: FontWeight.w600),
        ),
        subtitle: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 2),
            Text(
              r.customerName ?? (r.customerEmail ?? 'Customer'),
              style: const TextStyle(fontSize: 12),
            ),
            const SizedBox(height: 2),
            Text(
              '${r.isPending ? 'expires' : 'redeemed'} $dateLabel · ${r.qrCode}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 11, color: scheme.onSurfaceVariant),
            ),
          ],
        ),
        trailing: r.isRedeemed && r.finalAmount != null
            ? Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text('₹${r.finalAmount}',
                      style: const TextStyle(fontWeight: FontWeight.w600)),
                  if (r.discountApplied != null)
                    Text('−₹${r.discountApplied}',
                        style: TextStyle(
                            color: scheme.primary,
                            fontSize: 12,
                            fontWeight: FontWeight.w500)),
                ],
              )
            : null,
      ),
    );
  }
}

class _StatusAvatar extends StatelessWidget {
  const _StatusAvatar({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final s = status.toUpperCase();
    late final Color bg;
    late final IconData icon;
    late final Color fg;
    switch (s) {
      case 'REDEEMED':
        bg = Colors.green.shade100;
        fg = Colors.green.shade800;
        icon = Icons.check;
        break;
      case 'PENDING':
        bg = Colors.amber.shade100;
        fg = Colors.amber.shade900;
        icon = Icons.hourglass_bottom;
        break;
      case 'EXPIRED':
        bg = Colors.grey.shade300;
        fg = Colors.grey.shade700;
        icon = Icons.timer_off_outlined;
        break;
      case 'CANCELLED':
        bg = Colors.red.shade100;
        fg = Colors.red.shade700;
        icon = Icons.close;
        break;
      default:
        bg = Colors.grey.shade200;
        fg = Colors.black54;
        icon = Icons.help_outline;
    }
    return CircleAvatar(
      radius: 18,
      backgroundColor: bg,
      child: Icon(icon, color: fg, size: 18),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.qr_code_2,
                size: 64, color: Theme.of(context).colorScheme.outline),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}
