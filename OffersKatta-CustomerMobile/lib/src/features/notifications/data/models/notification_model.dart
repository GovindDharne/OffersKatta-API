import '../../domain/entities/notification.dart';

class NotificationModel {
  NotificationModel({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.isRead,
    required this.createdAt,
    this.data,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) => NotificationModel(
        id: json['id'] as String,
        type: json['type'] as String? ?? 'SYSTEM',
        title: json['title'] as String,
        body: json['body'] as String,
        isRead: json['isRead'] as bool? ?? false,
        createdAt: DateTime.parse(json['createdAt'] as String),
        data: json['data'] is Map<String, dynamic> ? json['data'] as Map<String, dynamic> : null,
      );

  final String id;
  final String type;
  final String title;
  final String body;
  final bool isRead;
  final DateTime createdAt;
  final Map<String, dynamic>? data;

  AppNotification toEntity() => AppNotification(
        id: id,
        type: type,
        title: title,
        body: body,
        isRead: isRead,
        createdAt: createdAt,
        data: data,
      );
}
