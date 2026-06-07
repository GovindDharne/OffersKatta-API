import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/providers.dart';
import '../../data/payments_repository.dart';

final paymentsRepositoryProvider = Provider<PaymentsRepository>(
  (ref) => PaymentsRepository(ref.watch(apiClientProvider)),
);

final paymentConfigProvider = FutureProvider<PaymentConfig>(
  (ref) => ref.watch(paymentsRepositoryProvider).config(),
);

final boostOptionsProvider = FutureProvider<List<BoostOption>>(
  (ref) => ref.watch(paymentsRepositoryProvider).boostOptions(),
);
