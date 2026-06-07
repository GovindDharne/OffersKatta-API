import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/providers.dart';
import '../../data/datasources/brands_remote_datasource.dart';
import '../../data/repositories/brands_repository_impl.dart';
import '../../domain/entities/brand.dart';

final brandsRemoteProvider = Provider<BrandsRemoteDataSource>(
  (ref) => BrandsRemoteDataSource(ref.watch(apiClientProvider)),
);

final brandsRepositoryProvider = Provider<BrandsRepository>(
  (ref) => BrandsRepository(ref.watch(brandsRemoteProvider)),
);

/// All brands the current seller owns/manages.
final myBrandsProvider = FutureProvider<List<Brand>>(
  (ref) => ref.watch(brandsRepositoryProvider).listMine(),
);

final brandTypesProvider = FutureProvider<List<BrandType>>(
  (ref) => ref.watch(brandsRepositoryProvider).brandTypes(),
);
