-- Tạo cơ sở dữ liệu
CREATE DATABASE IF NOT EXISTS food_app;
USE food_app;

-- Tạo bảng users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(100) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tạo bảng products (tên đúng thay vì food_items)
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  category VARCHAR(50) NOT NULL,
  image_path VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tạo bảng orders
CREATE TABLE IF NOT EXISTS orders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Tạo bảng order_items (KHÔNG cần cột name, dùng JOIN từ products)
CREATE TABLE IF NOT EXISTS order_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Thêm dữ liệu mẫu cho bảng users
INSERT INTO users (name, email, password, role) VALUES
('Admin User', 'admin@example.com', 'admin123', 'admin'),
('Test User', 'user@example.com', 'user123', 'user');

-- Thêm dữ liệu mẫu cho bảng products
INSERT INTO products (name, description, price, category, image_path) VALUES
('Pizza Margherita', 'Classic pizza with tomato sauce and mozzarella', 9.99, 'Pizza', 'assets/images/pizza1.jpg'),
('Hamburger', 'Beef patty with lettuce, tomato, and cheese', 7.99, 'Burger', 'assets/images/burger1.jpg'),
('Chicken Salad', 'Fresh salad with grilled chicken', 6.99, 'Salad', 'assets/images/salad1.jpg'),
('Phone', 'Smartphone mới nhất', 41650000, 'Electronics', 'assets/images/phone.jpg');
