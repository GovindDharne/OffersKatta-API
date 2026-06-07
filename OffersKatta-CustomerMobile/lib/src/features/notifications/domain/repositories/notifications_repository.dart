import '../entities/notification.dart';

abstract class NotificationsRepository {
  Future<List<AppNotification>> list({int page = 1, int limit = 50});
  Future<int> unreadCount();
  Future<void> markRead(String id);
  Future<void> markAllRead();
}
