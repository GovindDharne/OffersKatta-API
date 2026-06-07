import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/providers.dart';
import '../../data/datasources/redemptions_remote_datasource.dart';
import '../../data/repositories/redemptions_repository_impl.dart';
import '../../domain/entities/redemption.dart';
import '../../domain/repositories/redemptions_repository.dart';
import '../../domain/usecases/redemptions_usecases.dart';

final redemptionsRemoteProvider = Provider<RedemptionsRemoteDataSource>(
  (ref) => RedemptionsRemoteDataSource(ref.watch(apiClientProvider)),
);

final redemptionsRepositoryProvider = Provider<RedemptionsRepository>(
  (ref) => RedemptionsRepositoryImpl(ref.watch(redemptionsRemoteProvider)),
);

final issueRedemptionUseCaseProvider =
    Provider((ref) => IssueRedemptionUseCase(ref.watch(redemptionsRepositoryProvider)));
final cancelRedemptionUseCaseProvider =
    Provider((ref) => CancelRedemptionUseCase(ref.watch(redemptionsRepositoryProvider)));
final myRedemptionsUseCaseProvider =
    Provider((ref) => MyRedemptionsUseCase(ref.watch(redemptionsRepositoryProvider)));

final myRedemptionsProvider = FutureProvider<List<Redemption>>((ref) {
  return ref.watch(myRedemptionsUseCaseProvider)();
});

class RedemptionsController extends StateNotifier<AsyncValue<void>> {
  RedemptionsController(this._ref) : super(const AsyncValue.data(null));
  final Ref _ref;

  Future<IssuedRedemption> issueFor(String offerId) async {
    state = const AsyncValue.loading();
    try {
      final issued = await _ref.read(issueRedemptionUseCaseProvider)(offerId);
      _ref.invalidate(myRedemptionsProvider);
      state = const AsyncValue.data(null);
      return issued;
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }

  Future<void> cancel(String qrCode) async {
    state = const AsyncValue.loading();
    try {
      await _ref.read(cancelRedemptionUseCaseProvider)(qrCode);
      _ref.invalidate(myRedemptionsProvider);
      state = const AsyncValue.data(null);
    } catch (e, st) {
      state = AsyncValue.error(e, st);
      rethrow;
    }
  }
}

final redemptionsControllerProvider =
    StateNotifierProvider<RedemptionsController, AsyncValue<void>>((ref) => RedemptionsController(ref));
