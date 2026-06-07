import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/providers.dart';
import '../../../../core/network/api_envelope.dart';
import '../../data/datasources/offers_remote_datasource.dart';
import '../../data/repositories/offers_repository_impl.dart';
import '../../domain/entities/offer.dart';
import '../../domain/repositories/offers_repository.dart';
import '../../domain/usecases/offers_usecases.dart';

final offersRemoteProvider = Provider<OffersRemoteDataSource>(
  (ref) => OffersRemoteDataSource(ref.watch(apiClientProvider)),
);

final offersRepositoryProvider = Provider<OffersRepository>(
  (ref) => OffersRepositoryImpl(ref.watch(offersRemoteProvider)),
);

final searchOffersUseCaseProvider = Provider((ref) => SearchOffersUseCase(ref.watch(offersRepositoryProvider)));
final nearbyOffersUseCaseProvider = Provider((ref) => GetNearbyOffersUseCase(ref.watch(offersRepositoryProvider)));
final offerDetailUseCaseProvider = Provider((ref) => GetOfferDetailUseCase(ref.watch(offersRepositoryProvider)));
final listCategoriesUseCaseProvider = Provider((ref) => ListCategoriesUseCase(ref.watch(offersRepositoryProvider)));
final listBanksUseCaseProvider = Provider((ref) => ListBanksUseCase(ref.watch(offersRepositoryProvider)));

// Featured offers for the home screen
final featuredOffersProvider = FutureProvider<List<Offer>>((ref) async {
  final page = await ref.watch(searchOffersUseCaseProvider)(isFeatured: true, limit: 12);
  return page.items;
});

final categoriesProvider = FutureProvider<List<Category>>((ref) {
  return ref.watch(listCategoriesUseCaseProvider)();
});

final banksProvider = FutureProvider<List<Bank>>((ref) {
  return ref.watch(listBanksUseCaseProvider)();
});

/// Search args wrapper so the family key is comparable.
class SearchArgs {
  const SearchArgs({this.query, this.categoryId, this.bankId, this.page = 1});
  final String? query;
  final String? categoryId;
  final String? bankId;
  final int page;

  @override
  bool operator ==(Object other) =>
      other is SearchArgs &&
      other.query == query &&
      other.categoryId == categoryId &&
      other.bankId == bankId &&
      other.page == page;

  @override
  int get hashCode => Object.hash(query, categoryId, bankId, page);
}

final searchOffersProvider = FutureProvider.family<Paginated<Offer>, SearchArgs>((ref, args) {
  return ref.watch(searchOffersUseCaseProvider)(
    search: args.query,
    categoryId: args.categoryId,
    bankId: args.bankId,
    page: args.page,
  );
});

class NearbyArgs {
  const NearbyArgs({required this.latitude, required this.longitude, this.radiusKm = 10, this.categoryId});
  final double latitude;
  final double longitude;
  final double radiusKm;
  final String? categoryId;

  @override
  bool operator ==(Object other) =>
      other is NearbyArgs &&
      other.latitude == latitude &&
      other.longitude == longitude &&
      other.radiusKm == radiusKm &&
      other.categoryId == categoryId;

  @override
  int get hashCode => Object.hash(latitude, longitude, radiusKm, categoryId);
}

final nearbyOffersProvider = FutureProvider.family<Paginated<Offer>, NearbyArgs>((ref, args) {
  return ref.watch(nearbyOffersUseCaseProvider)(
    latitude: args.latitude,
    longitude: args.longitude,
    radiusKm: args.radiusKm,
    categoryId: args.categoryId,
  );
});

final offerDetailProvider = FutureProvider.family<Offer, String>((ref, id) {
  return ref.watch(offerDetailUseCaseProvider)(id);
});
