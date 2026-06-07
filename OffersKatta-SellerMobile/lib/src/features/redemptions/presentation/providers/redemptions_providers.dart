import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/providers.dart';
import '../../data/datasources/redemptions_remote_datasource.dart';
import '../../data/models/redemption_models.dart';
import '../../data/repositories/redemptions_repository_impl.dart';

final redemptionsRemoteProvider = Provider<RedemptionsRemoteDataSource>(
  (ref) => RedemptionsRemoteDataSource(ref.watch(apiClientProvider)),
);

final redemptionsRepositoryProvider = Provider<RedemptionsRepository>(
  (ref) => RedemptionsRepository(ref.watch(redemptionsRemoteProvider)),
);

/// Recent redemptions at a branch, refreshed by calling `ref.invalidate(...)`
/// after a successful confirm so the panel updates immediately.
final branchRedemptionsProvider =
    FutureProvider.family<List<RedemptionInfo>, String>((ref, branchId) {
  return ref.watch(redemptionsRepositoryProvider).forBranch(branchId);
});
