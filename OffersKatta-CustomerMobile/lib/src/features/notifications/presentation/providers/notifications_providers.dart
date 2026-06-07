import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/di/providers.dart';
import '../../data/datasources/notifications_remote_datasource.dart';
import '../../data/repositories/notifications_repository_impl.dart';
import '../../domain/entities/notification.dart';
import '../../domain/repositories/notifications_repository.dart';
import '../../domain/usecases/notifications_usecases.dart';

final notificationsRemoteProvider = Provider<NotificationsRemoteDataSource>(
  (ref) => NotificationsRemoteDataSource(ref.watch(apiClientProvider)),
);

final notificationsRepositoryProvider = Provider<NotificationsRepository>(
  (ref) => NotificationsRepositoryImpl(ref.watch(notificationsRemoteProvider)),
);

final listNotificationsUseCaseProvider =
    Provider((ref) => ListNotificationsUseCase(ref.watch(notificationsRepositoryProvider)));
final markReadUseCaseProvider =
    Provider((ref) => MarkNotificationReadUseCase(ref.watch(notificationsRepositoryProvider)));
final markAllReadUseCaseProvider =
    Provider((ref) => MarkAllNotificationsReadUseCase(ref.watch(notificationsRepositoryProvider)));
final unreadCountUseCaseProvider =
    Provider((ref) => UnreadCountUseCase(ref.watch(notificationsRepositoryProvider)));

final notificationsProvider = FutureProvider<List<AppNotification>>((ref) {
  return ref.watch(listNotificationsUseCaseProvider)();
});

final unreadCountProvider = FutureProvider<int>((ref) {
  return ref.watch(unreadCountUseCaseProvider)();
});
