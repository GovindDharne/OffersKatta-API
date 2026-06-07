import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/providers.dart';
import '../../data/datasources/branches_remote_datasource.dart';
import '../../data/repositories/branches_repository.dart';
import '../../domain/entities/branch.dart';

final branchesRemoteProvider = Provider<BranchesRemoteDataSource>(
  (ref) => BranchesRemoteDataSource(ref.watch(apiClientProvider)),
);

final branchesRepositoryProvider = Provider<BranchesRepository>(
  (ref) => BranchesRepository(ref.watch(branchesRemoteProvider)),
);

/// Branches for a specific brand. Keyed by brandId.
final branchesForBrandProvider =
    FutureProvider.family<List<BusinessBranch>, String>((ref, brandId) {
  return ref.watch(branchesRepositoryProvider).listForBrand(brandId);
});
