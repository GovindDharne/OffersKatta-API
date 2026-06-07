import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/offers_providers.dart';
import '../widgets/offer_card.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final categories = ref.watch(categoriesProvider);
    final featured = ref.watch(featuredOffersProvider);
    final scheme = Theme.of(context).colorScheme;

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(featuredOffersProvider);
        ref.invalidate(categoriesProvider);
      },
      child: CustomScrollView(
        slivers: [
          // Hero
          SliverToBoxAdapter(
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 28),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft, end: Alignment.bottomRight,
                  colors: [scheme.primaryContainer, scheme.surface],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Discover deals', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
                  Text('near you', style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  Text(
                    'Restaurants, hotels, salons, gyms, shops, and local businesses.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                  ),
                  const SizedBox(height: 16),
                  FilledButton.icon(
                    onPressed: () => context.push('/nearby'),
                    icon: const Icon(Icons.near_me_outlined),
                    label: const Text('Browse nearby'),
                  ),
                ],
              ),
            ),
          ),

          // Categories
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
            sliver: SliverToBoxAdapter(
              child: Text('Categories', style: Theme.of(context).textTheme.titleMedium),
            ),
          ),
          SliverToBoxAdapter(
            child: SizedBox(
              height: 90,
              child: categories.when(
                data: (cats) => ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  itemCount: cats.length,
                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                  itemBuilder: (_, i) {
                    final c = cats[i];
                    return Material(
                      color: scheme.secondaryContainer,
                      borderRadius: BorderRadius.circular(12),
                      child: InkWell(
                        onTap: () => context.push('/search?categoryId=${c.id}'),
                        borderRadius: BorderRadius.circular(12),
                        child: Container(
                          width: 110,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          alignment: Alignment.center,
                          child: Text(
                            c.name,
                            textAlign: TextAlign.center,
                            style: TextStyle(color: scheme.onSecondaryContainer, fontWeight: FontWeight.w600),
                          ),
                        ),
                      ),
                    );
                  },
                ),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(child: Text('Could not load categories')),
              ),
            ),
          ),

          // Featured
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 12),
            sliver: SliverToBoxAdapter(
              child: Row(
                children: [
                  const Icon(Icons.auto_awesome_outlined, size: 18),
                  const SizedBox(width: 6),
                  Text('Featured offers', style: Theme.of(context).textTheme.titleMedium),
                ],
              ),
            ),
          ),
          featured.when(
            data: (offers) {
              if (offers.isEmpty) {
                return const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.all(20),
                    child: Text('No featured offers yet.'),
                  ),
                );
              }
              return SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                sliver: SliverGrid(
                  gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                    maxCrossAxisExtent: 280,
                    mainAxisExtent: 260,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => OfferCard(offer: offers[i]),
                    childCount: offers.length,
                  ),
                ),
              );
            },
            loading: () => const SliverToBoxAdapter(
              child: Padding(
                padding: EdgeInsets.all(40),
                child: Center(child: CircularProgressIndicator()),
              ),
            ),
            error: (e, _) => SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Text('Failed to load offers: $e'),
              ),
            ),
          ),
          const SliverPadding(padding: EdgeInsets.only(bottom: 24)),
        ],
      ),
    );
  }
}
