import { DataTypes } from 'sequelize'
import { sequelize } from '../config/database.js'

export const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  nickname: { type: DataTypes.STRING(50), allowNull: false },
  realName: { type: DataTypes.STRING(50), allowNull: false, field: 'real_name' },
  password: { type: DataTypes.STRING(255), allowNull: false },
  avatar: { type: DataTypes.STRING(255), defaultValue: '' },
  campus: { type: DataTypes.STRING(100), defaultValue: '' }
}, { tableName: 'users' })

export const Category = sequelize.define('Category', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(50), allowNull: false },
  icon: { type: DataTypes.STRING(255), defaultValue: '' }
}, { tableName: 'categories' })

export const Product = sequelize.define('Product', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  categoryId: { type: DataTypes.INTEGER, field: 'category_id' },
  title: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  condition: { type: DataTypes.STRING(20), defaultValue: '九成新' },
  category: { type: DataTypes.STRING(50), defaultValue: '其他' },
  status: { type: DataTypes.STRING(20), defaultValue: 'available' },
  isbn: { type: DataTypes.STRING(20), defaultValue: '' },
  bookTitle: { type: DataTypes.STRING(200), field: 'book_title', defaultValue: '' },
  bookAuthor: { type: DataTypes.STRING(200), field: 'book_author', defaultValue: '' },
  bookPublisher: { type: DataTypes.STRING(200), field: 'book_publisher', defaultValue: '' },
  bookCover: { type: DataTypes.STRING(500), field: 'book_cover', defaultValue: '' },
  originalPrice: { type: DataTypes.DECIMAL(10, 2), field: 'original_price', defaultValue: 0 }
}, { tableName: 'products' })

export const ProductImage = sequelize.define('ProductImage', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER, allowNull: false, field: 'product_id' },
  imagePath: { type: DataTypes.STRING(500), allowNull: false, field: 'image_path' },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0, field: 'sort_order' }
}, { tableName: 'product_images' })

export const CartItem = sequelize.define('CartItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  productId: { type: DataTypes.INTEGER, allowNull: false, field: 'product_id' }
}, { tableName: 'cart_items' })

export const Order = sequelize.define('Order', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  buyerId: { type: DataTypes.INTEGER, allowNull: false, field: 'buyer_id' },
  totalPrice: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'total_price' },
  status: { type: DataTypes.STRING(20), defaultValue: 'pending' }
}, { tableName: 'orders' })

export const OrderItem = sequelize.define('OrderItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderId: { type: DataTypes.INTEGER, allowNull: false, field: 'order_id' },
  productId: { type: DataTypes.INTEGER, allowNull: false, field: 'product_id' },
  sellerId: { type: DataTypes.INTEGER, allowNull: false, field: 'seller_id' },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
}, { tableName: 'order_items' })

export const Favorite = sequelize.define('Favorite', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  productId: { type: DataTypes.INTEGER, allowNull: false, field: 'product_id' }
}, { tableName: 'favorites' })

export const Message = sequelize.define('Message', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  productId: { type: DataTypes.INTEGER, field: 'product_id' },
  senderId: { type: DataTypes.INTEGER, allowNull: false, field: 'sender_id' },
  receiverId: { type: DataTypes.INTEGER, allowNull: false, field: 'receiver_id' },
  content: { type: DataTypes.TEXT, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_read' }
}, { tableName: 'messages' })

export const Wishlist = sequelize.define('Wishlist', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  title: { type: DataTypes.STRING(200), defaultValue: '' },
  author: { type: DataTypes.STRING(200), defaultValue: '' },
  isbn: { type: DataTypes.STRING(20), defaultValue: '' }
}, { tableName: 'wishlists' })

export const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  type: { type: DataTypes.STRING(50), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_read' }
}, { tableName: 'notifications' })
User.hasMany(Product, { foreignKey: 'user_id', as: 'products' })
Product.belongsTo(User, { foreignKey: 'user_id', as: 'seller' })

Product.hasMany(ProductImage, { foreignKey: 'product_id', as: 'images' })
ProductImage.belongsTo(Product, { foreignKey: 'product_id', as: 'product' })

User.hasMany(CartItem, { foreignKey: 'user_id', as: 'cartItems' })
CartItem.belongsTo(User, { foreignKey: 'user_id', as: 'user' })
CartItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' })

Order.hasMany(OrderItem, { foreignKey: 'order_id', as: 'items' })
OrderItem.belongsTo(Order, { foreignKey: 'order_id', as: 'order' })
OrderItem.belongsTo(Product, { foreignKey: 'product_id', as: 'product' })

User.hasMany(Favorite, { foreignKey: 'user_id', as: 'favorites' })
Favorite.belongsTo(User, { foreignKey: 'user_id', as: 'user' })
Favorite.belongsTo(Product, { foreignKey: 'product_id', as: 'product' })

User.hasMany(Wishlist, { foreignKey: 'user_id', as: 'wishlists' })
Wishlist.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

User.hasMany(Message, { foreignKey: 'sender_id', as: 'sentMessages' })
User.hasMany(Message, { foreignKey: 'receiver_id', as: 'receivedMessages' })
Message.belongsTo(Product, { foreignKey: 'product_id', as: 'product' })

export { sequelize }