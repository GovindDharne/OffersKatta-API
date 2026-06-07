import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../brands/presentation/providers/brands_providers.dart';
import '../providers/offers_providers.dart';
import 'boost_sheet.dart';
import 'notify_sheet.dart';
import 'offer_edit_screen.dart';

class OffersScreen extends ConsumerStatefulWidget {
  const OffersScreen({super.key});

  @override
  ConsumerState<OffersScreen> createState() => _OffersScreenState();
}

class _OffersScreenState extends ConsumerState<OffersScreen> {
  String? _brandId;

  @override
  Widget build(BuildContext context) {
    final brands = ref.watch(myBrandsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Offers'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/dashboard'),
        ),
      ),
      floatingActionButton: _brandId == null
          ? null
          : FloatingActionButton.extended(
              icon: const Icon(Icons.add),
              label: const Text('New offer'),
              onPressed: () => Navigator.of(context).push(MaterialPageRoute(
                builder: (_) => OfferEditScreen(initialBrandId: _brandId),
              )),
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
                    Icon(Icons.local_offer_outlined,
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
              Expanded(child: _OfferList(brandId: _brandId!)),
            ],
          );
        },
      ),
    );
  }
}

class _OfferList extends ConsumerWidget {
  const _OfferList({required this.brandId});
  final String brandId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offers = ref.watch(offersForBrandProvider(brandId));
    final dateFmt = DateFormat('MMM d');
    return offers.when(
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
                onPressed: () => ref.invalidate(offersForBrandProvider(brandId)),
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
                  Icon(Icons.discount_outlined,
                      size: 64, color: Theme.of(context).colorScheme.outline),
                  const SizedBox(height: 12),
                  const Text('No offers yet.'),
                ],
              ),
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: () async => ref.invalidate(offersForBrandProvider(brandId)),
          child: ListView.separated(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
            itemCount: items.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (_, i) {
              final o = items[i];
              return Card(
                child: ListTile(
                  leading: o.listImage != null
                      ? ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: SizedBox(
                            width: 48, height: 48,
                            child: Image.network(o.listImage!, fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const Icon(Icons.broken_image),
                            ),
                          ),
                        )
                      : const CircleAvatar(child: Icon(Icons.local_offer)),
                  title: Row(
                    children: [
                      Expanded(child: Text(o.title, maxLines: 1, overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.w600))),
                      if (o.isFeatured) ...[
                        const SizedBox(width: 6),
                        const Icon(Icons.rocket_launch, size: 14, color: Colors.orange),
                      ],
                    ],
                  ),
                  subtitle: Text(
                    '${o.branchName ?? ''} · ${_label(o.offerType, o.discountValue)} · '
                    '${o.status.toLowerCase()} · '
                    '${dateFmt.format(o.startsAt)}–${dateFmt.format(o.expiresAt)}',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: PopupMenuButton<String>(
                    onSelected: (v) async {
                      if (v == 'edit') {
                        await Navigator.of(context).push(MaterialPageRoute(
                          builder: (_) => OfferEditScreen(initialBrandId: brandId, offerId: o.id),
                        ));
                        ref.invalidate(offersForBrandProvider(brandId));
                      } else if (v == 'publish' || v == 'unpublish') {
                        final newStatus = v == 'publish' ? 'PUBLISHED' : 'DRAFT';
                        try {
                          await ref.read(offersRepositoryProvider).update(o.id, {'status': newStatus});
                          ref.invalidate(offersForBrandProvider(brandId));
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(
                                v == 'publish' ? 'Offer published' : 'Offer moved to draft',
                              )),
                            );
                          }
                        } catch (e) {
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text('Status update failed: $e')),
                            );
                          }
                        }
                      } else if (v == 'boost') {
                        // In-app Razorpay Checkout (Android/iOS); on web the
                        // sheet itself falls back to opening the panel.
                        await showBoostSheet(context, offer: o, brandId: brandId);
                        ref.invalidate(offersForBrandProvider(brandId));
                      } else if (v == 'notify') {
                        await showNotifySheet(context, offer: o);
                      } else if (v == 'delete') {
                        final ok = await showDialog<bool>(
                          context: context,
                          builder: (_) => AlertDialog(
                            title: const Text('Archive offer?'),
                            content: Text('"${o.title}" will be moved to archived.'),
                            actions: [
                              TextButton(
                                  onPressed: () => Navigator.of(context).pop(false),
                                  child: const Text('Cancel')),
                              FilledButton.tonal(
                                style: FilledButton.styleFrom(
                                    foregroundColor: Theme.of(context).colorScheme.error),
                                onPressed: () => Navigator.of(context).pop(true),
                                child: const Text('Archive'),
                              ),
                            ],
                          ),
                        );
                        if (ok == true) {
                          try {
                            await ref.read(offersRepositoryProvider).delete(o.id);
                            ref.invalidate(offersForBrandProvider(brandId));
                          } catch (e) {
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Archive failed: $e')),
                              );
                            }
                          }
                        }
                      }
                    },
                    itemBuilder: (_) => [
                      const PopupMenuItem(value: 'edit', child: Text('Edit')),
                      if (o.status == 'DRAFT' || o.status == 'PAUSED' || o.status == 'EXPIRED')
                        const PopupMenuItem(
                          value: 'publish',
                          child: Row(children: [
                            Icon(Icons.public, size: 16, color: Colors.green),
                            SizedBox(width: 8),
                            Text('Publish'),
                          ]),
                        )
                      else if (o.status == 'PUBLISHED')
                        const PopupMenuItem(
                          value: 'unpublish',
                          child: Row(children: [
                            Icon(Icons.visibility_off_outlined, size: 16),
                            SizedBox(width: 8),
                            Text('Unpublish'),
                          ]),
                        ),
                      const PopupMenuItem(
                        value: 'boost',
                        child: Row(children: [
                          Icon(Icons.rocket_launch, size: 16, color: Colors.orange),
                          SizedBox(width: 8),
                          Text('Boost'),
                        ]),
                      ),
                      if (o.status == 'PUBLISHED')
                        const PopupMenuItem(
                          value: 'notify',
                          child: Row(children: [
                            Icon(Icons.campaign_outlined, size: 16),
                            SizedBox(width: 8),
                            Text('Notify nearby'),
                          ]),
                        ),
                      const PopupMenuItem(value: 'delete', child: Text('Archive')),
                    ],
                  ),
                  onTap: () async {
                    await Navigator.of(context).push(MaterialPageRoute(
                      builder: (_) => OfferEditScreen(initialBrandId: brandId, offerId: o.id),
                    ));
                    ref.invalidate(offersForBrandProvider(brandId));
                  },
                ),
              );
            },
          ),
        );
      },
    );
  }

  String _label(String type, num value) {
    switch (type) {
      case 'PERCENTAGE': return '${value.toInt()}% off';
      case 'FLAT': return '₹${value.toInt()} off';
      case 'BUY_ONE_GET_ONE': return 'BOGO';
      case 'FREE_ITEM': return 'Free item';
      case 'BUNDLE': return 'Bundle';
      default: return 'Deal';
    }
  }
}
