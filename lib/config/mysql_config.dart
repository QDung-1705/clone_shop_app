class SupabaseConfig {
  // Cấu hình Supabase
  static const String supabaseUrl =
      'https://pypccclagewnbnvsyslb.supabase.co'; // Ví dụ: 'https://xyz123.supabase.co'
  static const String supabaseKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cGNjY2xhZ2V3bmJudnN5c2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5NTg5NTEsImV4cCI6MjA2MjUzNDk1MX0.WfB9CwuwxSPeTiNXcRvOldWDKASVSxkaawjNNqmAGJw'; // Khóa API công khai

  // Tên bảng (giữ nguyên nếu schema giống MySQL)
  static const String usersTable = 'users';
  static const String productsTable = 'products'; // Nếu vẫn sử dụng bảng này
  static const String ordersTable = 'orders';
  static const String orderItemsTable = 'order_items';
}
