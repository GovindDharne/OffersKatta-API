import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/providers.dart';
import '../../data/datasources/subscription_remote_datasource.dart';
import '../../data/models/subscription_models.dart';
import '../../data/repositories/subscription_repository_impl.dart';

final subscriptionRemoteProvider = Provider<SubscriptionRemoteDataSource>(
  (ref) => SubscriptionRemoteDataSource(ref.watch(apiClientProvider)),
);

final subscriptionRepositoryProvider = Provider<SubscriptionRepository>(
  (ref) => SubscriptionRepository(ref.watch(subscriptionRemoteProvider)),
);

final plansProvider = FutureProvider<List<Plan>>(
  (ref) => ref.watch(subscriptionRepositoryProvider).plans(),
);

final paymentsConfigProvider = FutureProvider<PaymentsConfig>(
  (ref) => ref.watch(subscriptionRepositoryProvider).paymentsConfig(),
);

final brandSubscriptionProvider = FutureProvider.family<SubscriptionInfo?, String>(
  (ref, brandId) => ref.watch(subscriptionRepositoryProvider).forBrand(brandId),
);

final brandPaymentsProvider = FutureProvider.family<List<PaymentRecord>, String>(
  (ref, brandId) => ref.watch(subscriptionRepositoryProvider).paymentsForBrand(brandId),
);
