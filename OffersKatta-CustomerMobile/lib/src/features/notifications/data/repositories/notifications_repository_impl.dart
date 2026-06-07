import '../../../../core/error/exceptions.dart';
import '../../../../core/error/failure.dart';
import '../../domain/entities/notification.dart';
import '../../domain/repositories/notifications_repository.dart';
import '../datasources/notifications_remote_datasource.dart';

class NotificationsRepositoryImpl implements NotificationsRepository {
  NotificationsRepositoryImpl(this._remote);
  final NotificationsRemoteDataSource _remote;

  @override
  Future<List<AppNotification>> list({int page = 1, int limit = 50}) async {
    try {
      return (await _remote.list(page: page, limit: limit))
          .map((m) => m.toEntity())
          .toList(growable: false);
    } on ApiException catch (e) {
      throw _map(e);
    }
  }

  @override
  Future<int> unreadCount() async {
    try { return await _remote.unreadCount(); }
    on ApiException catch (e) { throw _map(e); }
  }

  @override
  Future<void> markRead(String id) async {
    try { await _remote.markRead(id); }
    on ApiException catch (e) { throw _map(e); }
  }

  @override
  Future<void> markAllRead() async {
    try { await _remote.markAllRead(); }
    on ApiException catch (e) { throw _map(e); }
  }

  Failure _map(ApiException e) {
    if (e is NetworkException) return NetworkFailure(e.message);
    if (e is UnauthorizedException) return AuthFailure(e.message);
    return ServerFailure(e.message, statusCode: e.statusCode);
  }
}
