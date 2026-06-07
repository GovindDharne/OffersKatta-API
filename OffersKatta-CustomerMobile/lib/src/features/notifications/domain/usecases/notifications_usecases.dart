import '../entities/notification.dart';
import '../repositories/notifications_repository.dart';

class ListNotificationsUseCase {
  ListNotificationsUseCase(this._repo);
  final NotificationsRepository _repo;
  Future<List<AppNotification>> call() => _repo.list();
}

class MarkNotificationReadUseCase {
  MarkNotificationReadUseCase(this._repo);
  final NotificationsRepository _repo;
  Future<void> call(String id) => _repo.markRead(id);
}

class MarkAllNotificationsReadUseCase {
  MarkAllNotificationsReadUseCase(this._repo);
  final NotificationsRepository _repo;
  Future<void> call() => _repo.markAllRead();
}

class UnreadCountUseCase {
  UnreadCountUseCase(this._repo);
  final NotificationsRepository _repo;
  Future<int> call() => _repo.unreadCount();
}
