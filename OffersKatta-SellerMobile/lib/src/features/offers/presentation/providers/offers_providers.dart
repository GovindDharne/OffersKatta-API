import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/providers.dart';
import '../../data/datasources/offers_remote_datasource.dart';
import '../../data/repositories/offers_repository.dart';
import '../../domain/entities/offer.dart';

final offersRemoteProvider = Provider<OffersRemoteDataSource>(
  (ref) => OffersRemoteDataSource(ref.watch(apiClientProvider)),
);

final offersRepositoryProvider = Provider<OffersRepository>(
  (ref) => OffersRepository(ref.watch(offersRemoteProvider)),
);

final offersForBrandProvider =
    FutureProvider.family<List<Offer>, String>((ref, brandId) {
  return ref.watch(offersRepositoryProvider).listForBrand(brandId);
});

final offerDetailProvider =
    FutureProvider.family<Offer, String>((ref, id) {
  return ref.watch(offersRepositoryProvider).getById(id);
});

final bankCatalogProvider = FutureProvider<List<BankCatalog>>(
  (ref) => ref.watch(offersRepositoryProvider).banks(),
);
