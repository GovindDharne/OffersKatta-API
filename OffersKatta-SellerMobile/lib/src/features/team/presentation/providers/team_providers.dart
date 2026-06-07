import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/providers.dart';
import '../../data/team_repository.dart';

final teamRepositoryProvider = Provider<TeamRepository>(
  (ref) => TeamRepository(ref.watch(apiClientProvider)),
);

final invitationsForBrandProvider =
    FutureProvider.family<List<Invitation>, String>((ref, brandId) {
  return ref.watch(teamRepositoryProvider).listInvitations(brandId);
});
