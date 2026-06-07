import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../offers/presentation/widgets/offer_card.dart';
import '../providers/favorites_providers.dart';

class FavoritesScreen extends ConsumerWidget {
  const FavoritesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final favs = ref.watch(favoritesControllerProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Favorites')),
      body: favs.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, _) => Center(child: Text('Could not load favorites: $e')),
        data: (items) {
          if (items.isEmpty) {
            return const Center(child: Text('Tap the heart on any offer to save it here.'));
          }
          return RefreshIndicator(
            onRefresh: () => ref.read(favoritesControllerProvider.notifier).refresh(),
            child: GridView.builder(
              padding: const EdgeInsets.all(12),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 280,
                mainAxisExtent: 260,
                crossAxisSpacing: 10,
                mainAxisSpacing: 10,
              ),
              itemCount: items.length,
              itemBuilder: (_, i) => OfferCard(offer: items[i]),
            ),
          );
        },
      ),
    );
  }
}
