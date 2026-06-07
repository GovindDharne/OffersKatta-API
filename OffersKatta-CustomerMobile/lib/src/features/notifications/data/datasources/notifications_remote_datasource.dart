import '../../../../core/constants/api_constants.dart';
import '../../../../core/network/api_client.dart';
import '../models/notification_model.dart';

class NotificationsRemoteDataSource {
  NotificationsRemoteDataSource(this._api);
  final ApiClient _api;

  Future<List<NotificationModel>> list({int page = 1, int limit = 50}) async {
    final res = await _api.getPaginated<NotificationModel>(
      ApiConstants.notifications,
      query: {'page': page, 'limit': limit},
      fromJson: NotificationModel.fromJson,
    );
    return res.items;
  }

  Future<int> unreadCount() => _api.get(
        ApiConstants.notificationsUnread,
        decode: (json) => (json as Map<String, dynamic>)['count'] as int? ?? 0,
      );

  Future<void> markRead(String id) =>
      _api.patch(ApiConstants.notificationRead(id), decode: (_) => null);

  Future<void> markAllRead() =>
      _api.patch(ApiConstants.notificationsReadAll, decode: (_) => null);
}
