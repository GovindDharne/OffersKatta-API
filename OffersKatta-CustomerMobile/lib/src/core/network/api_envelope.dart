/// Shape of every successful API response:
/// `{ success: true, data: T, meta?: {...} }`
class ApiEnvelope<T> {
  ApiEnvelope({required this.data, this.meta});

  final T data;
  final Map<String, dynamic>? meta;
}

class PageMeta {
  PageMeta({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
    required this.hasNext,
    required this.hasPrev,
  });

  factory PageMeta.fromJson(Map<String, dynamic> json) => PageMeta(
        page: json['page'] as int? ?? 1,
        limit: json['limit'] as int? ?? 20,
        total: json['total'] as int? ?? 0,
        totalPages: json['totalPages'] as int? ?? 1,
        hasNext: json['hasNext'] as bool? ?? false,
        hasPrev: json['hasPrev'] as bool? ?? false,
      );

  final int page;
  final int limit;
  final int total;
  final int totalPages;
  final bool hasNext;
  final bool hasPrev;
}

class Paginated<T> {
  Paginated({required this.items, required this.meta});
  final List<T> items;
  final PageMeta meta;
}
