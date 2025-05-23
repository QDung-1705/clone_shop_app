const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3001;
const saltRounds = 10;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://pypccclagewnbnvsyslb.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5cGNjY2xhZ2V3bmJudnN5c2xiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY5NTg5NTEsImV4cCI6MjA2MjUzNDk1MX0.WfB9CwuwxSPeTiNXcRvOldWDKASVSxkaawjNNqmAGJw';
const supabase = createClient(supabaseUrl, supabaseKey);

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Detailed logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Test Supabase connection
async function testDatabaseConnection() {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1);
    if (error) throw error;
    console.log('Supabase connection successful');
    return true;
  } catch (error) {
    console.error('Supabase connection failed:', error);
    return false;
  }
}

// Start server after checking connection
let server;
async function startServer() {
  const dbConnected = await testDatabaseConnection();

  if (dbConnected) {
    server = app.listen(port, '0.0.0.0', () => {
      console.log(`Server running on port ${port}`);
      console.log(`Server is accessible at:`);
      console.log(`- Local: http://localhost:${port}`);
      console.log(`- For emulators: http://10.0.2.2:${port}`);
      console.log(`- Network: http://<your-local-ip>:${port}`);
    });
  } else {
    console.log('Server not started due to database connection issues');
  }
}

startServer();

// Graceful shutdown
let isShuttingDown = false;

process.on('SIGTERM', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('SIGTERM signal received: closing HTTP server');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    setTimeout(() => {
      console.log('Forcing exit after timeout');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
});

process.on('SIGINT', async () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('SIGINT signal received: closing HTTP server');
  if (server) {
    server.close(() => {
      console.log('HTTP server closed');
      process.exit(0);
    });

    setTimeout(() => {
      console.log('Forcing exit after timeout');
      process.exit(1);
    }, 5000);
  } else {
    process.exit(0);
  }
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Get user information
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const { data: users, error } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', userId);

    if (error) throw error;

    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      data: users[0]
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Login
app.post('/api/users/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ status: 'error', message: 'Email and password are required' });
    }

    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);

    if (error) throw error;

    if (users.length === 0) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({ status: 'error', message: 'Invalid credentials' });
    }

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role || 'user'
    };

    res.json({ status: 'success', message: 'Login successful', data: userData });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// Register
app.post('/api/users/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ status: 'error', message: 'All fields are required' });
    }

    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);

    if (checkError) throw checkError;

    if (existingUsers.length > 0) {
      return res.status(409).json({ status: 'error', message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const { data, error } = await supabase
      .from('users')
      .insert([{ name, email, password: hashedPassword, role: 'user' }])
      .select();

    if (error) throw error;

    res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      data: {
        id: data[0].id,
        name,
        email,
        role: 'user'
      }
    });
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// Create order
app.post('/api/orders', async (req, res) => {
  try {
    const { user_id, total_amount, items } = req.body;

    console.log('Received order request:', JSON.stringify({ user_id, total_amount, items }, null, 2));

    if (!user_id || !total_amount || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Invalid order data' });
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert([{ user_id, total_amount, status: 'pending' }])
      .select();

    if (orderError) throw orderError;

    const orderId = order[0].id;

    for (const item of items) {
      const productId = parseInt(item.product_id || item.id);

      if (isNaN(productId)) {
        throw new Error(`Invalid product ID: ${item.product_id || item.id}`);
      }

      const quantity = parseInt(item.quantity) || 1;
      const price = parseFloat(item.price) || 0;
      let productName = item.name;

      if (!productName) {
        console.warn(`Warning: Product name is null for product_id ${productId}`);

        const { data: products, error: productError } = await supabase
          .from('products')
          .select('name')
          .eq('id', productId);

        if (productError) throw productError;

        if (products.length > 0 && products[0].name) {
          console.log(`Found product name from database: ${products[0].name}`);
          productName = products[0].name;
        } else {
          productName = `Sản phẩm #${productId}`;
          console.log(`Using fallback name: ${productName}`);
        }
      }

      const { error: itemError } = await supabase
        .from('order_items')
        .insert([{ order_id: orderId, product_id: productId, name: productName, quantity, price }]);

      if (itemError) throw itemError;
    }

    res.status(201).json({
      status: 'success',
      message: 'Order created successfully',
      data: {
        order_id: orderId,
        user_id,
        total_amount,
        items
      }
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Change password
app.put('/api/users/:id/password', async (req, res) => {
  try {
    const userId = req.params.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Current password and new password are required'
      });
    }

    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId);

    if (userError) throw userError;

    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(currentPassword, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Current password is incorrect'
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', userId);

    if (updateError) throw updateError;

    res.json({
      status: 'success',
      message: 'Password updated successfully'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Get all orders
app.get('/api/orders', async (req, res) => {
  try {
    const { user_id, status } = req.query;

    let query = supabase
      .from('orders')
      .select(`
        *,
        users!inner(name)
      `);

    if (user_id) {
      query = query.eq('user_id', user_id);
    }

    if (status) {
      query = query.eq('status', status);
    }

    query = query.order('id', { ascending: false });

    console.log('Orders query:', query);

    const { data: orders, error } = await query;

    if (error) throw error;

    console.log(`Found ${orders.length} orders`);

    const ordersWithItems = await Promise.all(orders.map(async (order) => {
      const { data: items, error: itemError } = await supabase
        .from('order_items')
        .select(`
          *,
          products(name, image_path)
        `)
        .eq('order_id', order.id);

      if (itemError) throw itemError;

      console.log(`Order #${order.id} has ${items.length} items`);

      const itemsWithNames = items.map(item => ({
        ...item,
        name: item.name || item.product_name || `Sản phẩm #${item.product_id}`
      }));

      return {
        ...order,
        items: itemsWithNames
      };
    }));

    res.json({
      status: 'success',
      data: ordersWithItems
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Update order status
app.put('/api/orders/:id/status', async (req, res) => {
  try {
    const { status, reason } = req.body;
    const orderId = req.params.id;

    console.log(`Updating order #${orderId} status to: ${status}`);
    console.log('Request body:', req.body);

    if (!status) {
      return res.status(400).json({ status: 'error', message: 'Status is required' });
    }

    const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returning', 'returned'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid status. Valid values are: ${validStatuses.join(', ')}`
      });
    }

    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId);

    if (orderError) throw orderError;

    if (orders.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Order not found' });
    }

    const order = orders[0];

    const { data: items, error: itemError } = await supabase
      .from('order_items')
      .select('*')
      .eq('order_id', orderId);

    if (itemError) throw itemError;

    let productText = '';
    if (items.length > 0) {
      productText = items.length === 1 ? (items[0].name || `#${items[0].product_id}`) : `(${items.length} sản phẩm)`;
    }

    let updateData = { status };
    if (status === 'returning' && reason) {
      updateData.return_reason = reason;
    }
    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderId);

    if (updateError) throw updateError;

    let title, message;
    switch (status) {
      case 'processing':
        title = 'Đơn hàng đang được xử lý';
        message = `Đơn hàng ${productText} của bạn đang được xử lý.`;
        break;
      case 'shipped':
        title = 'Đơn hàng đang được giao';
        message = `Đơn hàng ${productText} của bạn đang được giao đến bạn.`;
        break;
      case 'delivered':
        if (order.status === 'returning') {
          title = 'Yêu cầu trả hàng bị từ chối';
          message = `Yêu cầu trả hàng cho đơn hàng ${productText} của bạn đã bị từ chối. Vui lòng liên hệ với chúng tôi để biết thêm chi tiết.`;
        } else {
          title = 'Đơn hàng đã giao thành công';
          message = `Đơn hàng ${productText} của bạn đã được giao thành công. Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!`;
        }
        break;
      case 'cancelled':
        title = 'Đơn hàng đã bị hủy';
        message = `Đơn hàng ${productText} của bạn đã bị hủy.`;
        break;
      case 'returning':
        title = 'Yêu cầu trả hàng đã được ghi nhận';
        message = `Yêu cầu trả hàng cho đơn hàng ${productText} của bạn đã được ghi nhận. Chúng tôi sẽ xem xét và phản hồi sớm.`;
        break;
      case 'returned':
        title = 'Đơn hàng đã được trả thành công';
        message = `Đơn hàng ${productText} của bạn đã được trả thành công. Tiền hoàn trả sẽ được chuyển lại cho bạn trong 3-5 ngày làm việc.`;
        break;
      default:
        title = 'Cập nhật trạng thái đơn hàng';
        message = `Đơn hàng ${productText} của bạn đã được cập nhật sang trạng thái ${status}.`;
    }

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert([{ user_id: order.user_id, title, message, is_read: false }]);

    if (notificationError) throw notificationError;

    res.json({
      status: 'success',
      message: 'Order status updated successfully',
      data: { id: orderId, status }
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Internal server error' });
  }
});

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;

    console.log(`Fetching products with category: ${category}, search: ${search}`);

    let query = supabase.from('products').select('*');

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    if (search && search.trim() !== '') {
      query = query.ilike('name', `%${search.trim()}%`);
      console.log(`Searching for products with name like: %${search.trim()}%`);
    }

    query = query.order('id', { ascending: false });

    console.log('Executing query:', query);

    const { data: rows, error } = await query;

    if (error) throw error;

    console.log(`Found ${rows.length} products`);

    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;

    const { data: rows, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId);

    if (error) throw error;

    if (rows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Product not found' });
    }

    res.json({ status: 'success', data: rows[0] });
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// Create product
app.post('/api/products', async (req, res) => {
  try {
    const { name, price, description, image_path, category } = req.body;

    if (!name || !price) {
      return res.status(400).json({ status: 'error', message: 'Name and price are required' });
    }

    const { data, error } = await supabase
      .from('products')
      .insert([{ name, price, description: description || '', image_path: image_path || '', category: category || 'Other' }])
      .select();

    if (error) throw error;

    res.status(201).json({
      status: 'success',
      message: 'Product created successfully',
      data: data[0]
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;
    const { name, price, description, image_path, category } = req.body;

    if (!name || !price) {
      return res.status(400).json({ status: 'error', message: 'Name and price are required' });
    }

    const { data, error } = await supabase
      .from('products')
      .update({ name, price, description: description || '', image_path: image_path || '', category: category || 'Other' })
      .eq('id', productId)
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Product not found' });
    }

    res.json({
      status: 'success',
      message: 'Product updated successfully',
      data: data[0]
    });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const productId = req.params.id;

    const { data, error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId)
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Product not found' });
    }

    res.json({
      status: 'success',
      message: 'Product deleted successfully',
      data: { id: productId }
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
});

// Get all users (for admin)
app.get('/api/users', async (req, res) => {
  try {
    console.log('Fetching all users...');

    const { data: rows, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`Found ${rows.length} users`);

    res.json({ status: 'success', data: rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Create user (for admin)
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ status: 'error', message: 'All fields are required' });
    }

    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email);

    if (checkError) throw checkError;

    if (existingUsers.length > 0) {
      return res.status(409).json({ status: 'error', message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const { data, error } = await supabase
      .from('users')
      .insert([{ name, email, password: hashedPassword, role }])
      .select();

    if (error) throw error;

    res.status(201).json({
      status: 'success',
      message: 'User created successfully',
      data: data[0]
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Update user (for admin and regular users)
app.put('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, password, role, profile_image } = req.body;

    if (!name || !email) {
      return res.status(400).json({ status: 'error', message: 'Name and email are required' });
    }

    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId);

    if (checkError) throw checkError;

    if (existingUsers.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    if (email !== existingUsers[0].email) {
      const { data: emailCheck, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .neq('id', userId);

      if (emailError) throw emailError;

      if (emailCheck.length > 0) {
        return res.status(409).json({ status: 'error', message: 'Email already exists' });
      }
    }

    let updateData = { name, email };

    if (password) {
      updateData.password = await bcrypt.hash(password, saltRounds);
    }

    if (role) {
      updateData.role = role;
    }

    if (profile_image) {
      updateData.profile_image = profile_image;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    res.json({
      status: 'success',
      message: 'User updated successfully',
      data: data[0]
    });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Delete user (for admin)
app.delete('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId);

    if (checkError) throw checkError;

    if (existingUsers.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    if (existingUsers[0].role === 'admin') {
      const { data: adminCount, error: countError } = await supabase
        .from('users')
        .select('id', { count: 'exact' })
        .eq('role', 'admin');

      if (countError) throw countError;

      if (adminCount.length <= 1) {
        return res.status(400).json({
          status: 'error',
          message: 'Cannot delete the last admin user'
        });
      }
    }

    const { data, error } = await supabase
      .from('users')
      .delete()
      .eq('id', userId)
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).json({ status: 'error', message: 'User not found' });
    }

    res.json({
      status: 'success',
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Debug products
app.get('/api/debug/products', async (req, res) => {
  try {
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('*');

    if (productError) throw productError;

    console.log('All products:', products);

    const { data: hamburgers, error: hamburgerError } = await supabase
      .from('products')
      .select('*')
      .ilike('name', '%Hamburger%');

    if (hamburgerError) throw hamburgerError;

    console.log('Hamburger products:', hamburgers);

    const { data: orderItems, error: itemError } = await supabase
      .from('order_items')
      .select('*')
      .limit(20);

    if (itemError) throw itemError;

    console.log('Recent order items:', orderItems);

    res.json({
      status: 'success',
      data: {
        allProducts: products,
        hamburgerProducts: hamburgers,
        recentOrderItems: orderItems
      }
    });
  } catch (error) {
    console.error('Error debugging products:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Check and fix product names in order_items
app.get('/api/debug/check-products', async (req, res) => {
  try {
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, name');

    if (productError) throw productError;

    console.log(`Found ${products.length} products in products table`);

    const { data: orderItems, error: itemError } = await supabase
      .from('order_items')
      .select(`
        id, order_id, product_id, name,
        products!left(id:found_product_id, name:product_name)
      `)
      .limit(50);

    if (itemError) throw itemError;

    console.log(`Checking ${orderItems.length} order items`);

    let missingProductCount = 0;
    let updatedCount = 0;

    for (const item of orderItems) {
      if (!item.products?.found_product_id) {
        missingProductCount++;
        console.log(`Order item #${item.id} has product_id ${item.product_id} but no matching product found`);
      }

      if (!item.name) {
        let productName = item.products?.product_name || `Sản phẩm #${item.product_id}`;

        const { error: updateError } = await supabase
          .from('order_items')
          .update({ name: productName })
          .eq('id', item.id);

        if (updateError) throw updateError;

        updatedCount++;
        console.log(`Updated order item #${item.id} with name: ${productName}`);
      }
    }

    res.json({
      status: 'success',
      message: `Found ${missingProductCount} order items with missing products. Updated ${updatedCount} items.`,
      data: {
        products,
        orderItems,
        missingProductCount,
        updatedCount
      }
    });
  } catch (error) {
    console.error('Error checking products:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Fix order items names
app.post('/api/admin/update-order-items', async (req, res) => {
  try {
    const { data: orderItems, error: itemError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, name')
      .or('name.is.null,name.eq.""');

    if (itemError) throw itemError;

    console.log(`Found ${orderItems.length} order items without names`);

    let updatedCount = 0;
    for (const item of orderItems) {
      const { data: products, error: productError } = await supabase
        .from('products')
        .select('name')
        .eq('id', item.product_id);

      if (productError) throw productError;

      let productName = products.length > 0 && products[0].name ? products[0].name : `Sản phẩm #${item.product_id}`;

      const { error: updateError } = await supabase
        .from('order_items')
        .update({ name: productName })
        .eq('id', item.id);

      if (updateError) throw updateError;

      updatedCount++;
    }

    res.json({
      status: 'success',
      message: `Updated ${updatedCount} order items with product names`,
      data: { total: orderItems.length, updated: updatedCount }
    });
  } catch (error) {
    console.error('Error updating order items:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Fix order items product_id
app.post('/api/admin/fix-order-items-product-id', async (req, res) => {
  try {
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, name, price')
      .order('id', { ascending: true })
      .limit(1);

    if (productError) throw productError;

    if (products.length === 0) {
      return res.status(400).json({
        status: 'error',
        message: 'No products found in the database'
      });
    }

    const defaultProduct = products[0];
    console.log(`Using default product: ${defaultProduct.name} (ID: ${defaultProduct.id})`);

    const { data: orderItems, error: itemError } = await supabase
      .from('order_items')
      .select(`
        id, product_id, name,
        products!left(id:product_id_check)
      `);

    if (itemError) throw itemError;

    const itemsToUpdate = orderItems.filter(item => !item.products?.product_id_check);

    let updatedCount = 0;
    for (const item of itemsToUpdate) {
      const { error: updateError } = await supabase
        .from('order_items')
        .update({ product_id: defaultProduct.id, name: defaultProduct.name })
        .eq('id', item.id);

      if (updateError) throw updateError;
      updatedCount++;
    }

    res.json({
      status: 'success',
      message: `Updated ${updatedCount} order items with valid product_id`,
      data: {
        defaultProduct,
        affectedRows: updatedCount
      }
    });
  } catch (error) {
    console.error('Error fixing order items product_id:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Get user orders
app.get('/users/:id/orders', async (req, res) => {
  try {
    const userId = req.params.id;

    console.log(`Getting orders for user ${userId}`);

    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`Found ${orders.length} orders for user ${userId}`);

    res.json({
      status: 'success',
      data: orders
    });
  } catch (error) {
    console.error('Error getting user orders:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Get order items
app.get('/orders/:id/items', async (req, res) => {
  try {
    const orderId = req.params.id;

    console.log(`Getting items for order ${orderId}`);

    const { data: items, error } = await supabase
      .from('order_items')
      .select(`
        *,
        products(image_path, name:product_name)
      `)
      .eq('order_id', orderId);

    if (error) throw error;

    console.log(`Found ${items.length} items for order ${orderId}`);

    res.json({
      status: 'success',
      data: items
    });
  } catch (error) {
    console.error('Error getting order items:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Update user profile
app.put('/api/users/profile/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const { name, email, password, profile_image } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        status: 'error',
        message: 'Name and email are required'
      });
    }

    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId);

    if (checkError) throw checkError;

    if (existingUsers.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    if (email !== existingUsers[0].email) {
      const { data: emailCheck, error: emailError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .neq('id', userId);

      if (emailError) throw emailError;

      if (emailCheck.length > 0) {
        return res.status(409).json({
          status: 'error',
          message: 'Email already exists'
        });
      }
    }

    let updateData = { name, email };

    if (password) {
      updateData.password = await bcrypt.hash(password, saltRounds);
    }

    if (profile_image) {
      updateData.profile_image = profile_image;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select();

    if (error) throw error;

    if (data.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    res.json({
      status: 'success',
      message: 'Profile updated successfully',
      data: data[0]
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Configure multer for local storage (optional, as we'll use Supabase Storage)
const uploadDir = path.join(__dirname, 'uploads');
const profileImagesDir = path.join(uploadDir, 'profile_images');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

if (!fs.existsSync(profileImagesDir)) {
  fs.mkdirSync(profileImagesDir);
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, profileImagesDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'profile-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, 'Uploads')));

// Upload profile image to Supabase Storage
app.post('/api/upload-profile-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        status: 'error',
        message: 'No file uploaded'
      });
    }

    const userId = req.body.user_id;
    if (!userId) {
      return res.status(400).json({
        status: 'error',
        message: 'User ID is required'
      });
    }

    const { data: users, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId);

    if (userError) throw userError;

    if (users.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'User not found'
      });
    }

    const filePath = req.file.path;
    const fileName = `profile_images/profile-${userId}-${Date.now()}${path.extname(req.file.originalname)}`;

    const fileBuffer = fs.readFileSync(filePath);

    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(fileName, fileBuffer, {
        contentType: req.file.mimetype
      });

    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase.storage
      .from('profile-images')
      .getPublicUrl(fileName);

    const imageUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from('users')
      .update({ profile_image: imageUrl })
      .eq('id', userId);

    if (updateError) throw updateError;

    fs.unlinkSync(filePath); // Delete local file after uploading to Supabase

    res.json({
      status: 'success',
      message: 'Profile image uploaded successfully',
      image_url: imageUrl
    });
  } catch (error) {
    console.error('Error uploading profile image:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Get user notifications
app.get('/api/users/:userId/notifications', async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!userId) {
      return res.status(400).json({ status: 'error', message: 'User ID is required' });
    }

    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('id, user_id, title, message, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`Found ${notifications.length} notifications for user ${userId}`);

    res.json({
      status: 'success',
      data: notifications
    });
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
  try {
    const notificationId = req.params.id;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) throw error;

    res.json({
      status: 'success',
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Mark all notifications as read
app.put('/api/users/:userId/notifications/read-all', async (req, res) => {
  try {
    const userId = req.params.userId;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId);

    if (error) throw error;

    res.json({
      status: 'success',
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get chat messages
app.get('/api/chat/messages/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;

    console.log(`Getting messages for user ${userId}`);

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    console.log(`Retrieved ${messages.length} messages for user ${userId}`);

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      status: 'success',
      data: messages
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Send chat message
app.post('/api/chat/messages', async (req, res) => {
  console.log('Received chat message request:', req.body);
  try {
    const { userId, message, sender } = req.body;

    if (!userId || !message || !sender) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields'
      });
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .insert([{ user_id: userId, sender, message }])
      .select();

    if (error) throw error;

    console.log('Message saved successfully, ID:', data[0].id);

    res.json({
      status: 'success',
      message: 'Message sent successfully',
      data: {
        id: data[0].id
      }
    });
  } catch (error) {
    console.error('Error sending chat message:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Get chat users (for admin)
app.get('/api/chat/users', async (req, res) => {
  try {
    const { data: users, error } = await supabase.rpc('get_chat_users', {});

    if (error) {
      console.error('Lỗi khi lấy danh sách người dùng chat:', error);
      throw new Error(`Lỗi truy vấn: ${error.message}`);
    }

    console.log(`Tìm thấy ${users.length} người dùng chat (trước định dạng):`, JSON.stringify(users, null, 2));

    const formattedUsers = users.map(user => {
      const formattedUser = {
        user_id: user.user_id ?? 0,
        user_name: user.user_name ?? 'Người dùng không tên',
        message: user.message ?? 'Không có tin nhắn',
        created_at: user.created_at ? new Date(user.created_at).toISOString() : new Date().toISOString(),
        unread_count: user.unread_count ?? 0
      };
      if (!formattedUser.user_name || !formattedUser.message || !formattedUser.created_at) {
        console.warn('Phát hiện giá trị null sau định dạng:', formattedUser);
      }
      return formattedUser;
    });

    console.log('Dữ liệu sau khi định dạng:', JSON.stringify(formattedUsers, null, 2));

    res.json({
      status: 'success',
      data: formattedUsers
    });
  } catch (error) {
    console.error('Lỗi khi lấy danh sách người dùng chat:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Lỗi máy chủ nội bộ'
    });
  }
});

// Mark messages as read
app.post('/api/chat/mark-read', async (req, res) => {
  try {
    const { userId, sender } = req.body;

    console.log(`Marking messages as read for user ${userId}, sender ${sender}`);

    const { error } = await supabase
      .from('chat_messages')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('sender', sender);

    if (error) throw error;

    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      status: 'success',
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Get order details
app.get('/api/orders/:id/details', async (req, res) => {
  try {
    const orderId = req.params.id;

    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId);

    if (orderError) throw orderError;

    if (orders.length === 0) {
      return res.status(404).json({
        status: 'error',
        message: 'Order not found'
      });
    }

    const { data: items, error: itemError } = await supabase
      .from('order_items')
      .select(`
        *,
        products(name, image_url)
      `)
      .eq('order_id', orderId);

    if (itemError) throw itemError;

    res.json({
      status: 'success',
      data: {
        order: orders[0],
        items
      }
    });
  } catch (error) {
    console.error('Error getting order details:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Fix order items for returning orders
app.get('/api/debug/fix-order-items', async (req, res) => {
  try {
    const { data: returningOrders, error: orderError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('status', 'returning');

    if (orderError) throw orderError;

    console.log(`Found ${returningOrders.length} orders with returning status`);

    let fixedItems = 0;
    for (const order of returningOrders) {
      const orderId = order.id;

      const { data: items, error: itemError } = await supabase
        .from('order_items')
        .select('id, order_id, product_id, name')
        .eq('order_id', orderId);

      if (itemError) throw itemError;

      console.log(`Order #${orderId} has ${items.length} items`);

      for (const item of items) {
        if (!item.name || item.name === '') {
          const { data: products, error: productError } = await supabase
            .from('products')
            .select('name')
            .eq('id', item.product_id);

          if (productError) throw productError;

          const productName = products.length > 0 ? products[0].name : `Sản phẩm #${item.product_id}`;

          const { error: updateError } = await supabase
            .from('order_items')
            .update({ name: productName })
            .eq('id', item.id);

          if (updateError) throw updateError;

          fixedItems++;
          console.log(`Fixed item #${item.id} with product name: ${productName}`);
        }
      }
    }

    res.json({
      status: 'success',
      message: `Fixed ${fixedItems} items in returning orders`,
      data: {
        returningOrders,
        fixedItems
      }
    });
  } catch (error) {
    console.error('Error fixing order items:', error);
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});