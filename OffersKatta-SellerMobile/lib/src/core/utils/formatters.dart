import 'package:intl/intl.dart';

String formatDate(DateTime d) => DateFormat('yyyy-MM-dd').format(d);
String formatDateTime(DateTime d) => DateFormat('yyyy-MM-dd HH:mm').format(d);
String formatRupee(num n) => '₹${NumberFormat('#,##0').format(n)}';
