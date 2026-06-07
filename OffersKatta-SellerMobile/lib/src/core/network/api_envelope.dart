/// The API wraps payloads as `{ success, data, error?, meta? }`.
class PageMeta {
  PageMeta({
    required this.page,
    required this.limit,
    required this.total,
    required this.totalPages,
    required this.hasNext,
    required this.hasPrev,
  });
  final int page;
  final int limit;
  final int total;
  final int totalPages;
  final bool hasNext;
  final bool hasPrev;

  factory PageMeta.fromJson(Map<String, dynamic> j) => PageMeta(
        page: (j['page'] as num).toInt(),
        limit: (j['limit'] as num).toInt(),
        total: (j['total'] as num).toInt(),
        totalPages: (j['totalPages'] as num).toInt(),
        hasNext: j['hasNext'] as bool? ?? false,
        hasPrev: j['hasPrev'] as bool? ?? false,
      );
}

class Paginated<T> {
  Paginated({required this.items, required this.meta});
  final List<T> items;
  final PageMeta meta;
}
