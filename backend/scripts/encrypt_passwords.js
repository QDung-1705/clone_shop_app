const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');

const saltRounds = 10;

// Cấu hình Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://pypccclagewnbnvsyslb.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cGNjY2xhZ2V3bmJudnN5c2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5NTg5NTEsImV4cCI6MjA2MjUzNDk1MX0.WfB9CwuwxSPeTiNXcRvOldWDKASVSxkaawjNNqmAGJw';
const supabase = createClient(supabaseUrl, supabaseKey);

async function encryptPasswords() {
  try {
    // Lấy tất cả người dùng
    const { data: users, error: selectError } = await supabase
      .from('users')
      .select('id, password');

    if (selectError) {
      throw new Error(`Lỗi khi lấy người dùng: ${selectError.message}`);
    }

    console.log(`Tìm thấy ${users.length} người dùng để cập nhật.`);

    // Mã hóa mật khẩu cho từng người dùng
    for (const user of users) {
      // Kiểm tra xem mật khẩu đã được mã hóa chưa
      if (!user.password.startsWith('$2b$') && !user.password.startsWith('$2a$')) {
        const hashedPassword = await bcrypt.hash(user.password, saltRounds);

        // Cập nhật mật khẩu đã mã hóa
        const { error: updateError } = await supabase
          .from('users')
          .update({ password: hashedPassword })
          .eq('id', user.id);

        if (updateError) {
          throw new Error(`Lỗi khi cập nhật mật khẩu cho ID ${user.id}: ${updateError.message}`);
        }

        console.log(`Đã cập nhật mật khẩu cho người dùng ID: ${user.id}`);
      } else {
        console.log(`Mật khẩu cho người dùng ID: ${user.id} đã được mã hóa.`);
      }
    }

    console.log('Tất cả mật khẩu đã được mã hóa thành công.');
  } catch (error) {
    console.error('Lỗi khi mã hóa mật khẩu:', error.message);
  } finally {
    // Supabase client tự động quản lý kết nối, không cần đóng thủ công
    console.log('Hoàn tất quá trình.');
  }
}

// Chạy hàm
encryptPasswords();