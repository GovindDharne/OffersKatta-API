import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/offers_providers.dart';
import '../widgets/offer_card.dart';

class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key, this.initialCategoryId});
  final String? initialCategoryId;

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  final _controller = TextEditingController();
  String _query = '';
  Timer? _debounce;
  String? _categoryId;
  String? _bankId;

  @override
  void initState() {
    super.initState();
    _categoryId = widget.initialCategoryId;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (mounted) setState(() => _query = value.trim());
    });
  }

  @override
  Widget build(BuildContext context) {
    final categories = ref.watch(categoriesProvider);
    final banks = ref.watch(banksProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Discover')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              controller: _controller,
              onChanged: _onChanged,
              textInputAction: TextInputAction.search,
              decoration: const InputDecoration(
                hintText: 'Search restaurants, salons, hotels…',
                prefixIcon: Icon(Icons.search),
              ),
            ),
          ),
          SizedBox(
            height: 44,
            child: categories.maybeWhen(
              data: (cats) => ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: cats.length + 1,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  if (i == 0) {
                    return FilterChip(
                      label: const Text('All'),
                      selected: _categoryId == null,
                      onSelected: (_) => setState(() => _categoryId = null),
                    );
                  }
                  final c = cats[i - 1];
                  return FilterChip(
                    label: Text(c.name),
                    selected: _categoryId == c.id,
                    onSelected: (s) => setState(() => _categoryId = s ? c.id : null),
                  );
                },
              ),
              orElse: () => const SizedBox.shrink(),
            ),
          ),
          SizedBox(
            height: 44,
            child: banks.maybeWhen(
              data: (bs) => ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: bs.length + 1,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  if (i == 0) {
                    return FilterChip(
                      avatar: const Icon(Icons.credit_card, size: 16),
                      label: const Text('All banks'),
                      selected: _bankId == null,
                      onSelected: (_) => setState(() => _bankId = null),
                    );
                  }
                  final b = bs[i - 1];
                  return FilterChip(
                    label: Text(b.name),
                    selected: _bankId == b.id,
                    onSelected: (s) => setState(() => _bankId = s ? b.id : null),
                  );
                },
              ),
              orElse: () => const SizedBox.shrink(),
            ),
          ),
          const Divider(height: 1),
          Expanded(child: _Results(query: _query, categoryId: _categoryId, bankId: _bankId)),
        ],
      ),
    );
  }
}

class _Results extends ConsumerWidget {
  const _Results({required this.query, required this.categoryId, required this.bankId});
  final String query;
  final String? categoryId;
  final String? bankId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final args = SearchArgs(query: query.isEmpty ? null : query, categoryId: categoryId, bankId: bankId);
    final result = ref.watch(searchOffersProvider(args));
    return result.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (e, _) => Center(child: Text('Could not search: $e')),
      data: (page) {
        if (page.items.isEmpty) {
          return const Center(child: Text('No offers match your filters.'));
        }
        return GridView.builder(
          padding: const EdgeInsets.all(12),
          gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
            maxCrossAxisExtent: 280,
            mainAxisExtent: 260,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
          ),
          itemCount: page.items.length,
          itemBuilder: (_, i) => OfferCard(offer: page.items[i]),
        );
      },
    );
  }
}
