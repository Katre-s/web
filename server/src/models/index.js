import { DataTypes } from 'sequelize'
import { sequelize } from '../config/database.js'

export const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  email: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  userNo: { type: DataTypes.STRING(20), field: 'user_no', defaultValue: '' },
  nickname: { type: DataTypes.STRING(50), allowNull: false },
  realName: { type: DataTypes.STRING(50), allowNull: false, field: 'real_name' },
  password: { type: DataTypes.STRING(255), allowNull: false },
  avatar: { type: DataTypes.STRING(255), defaultValue: '' },
  campus: { type: DataTypes.STRING(100), defaultValue: '' },
  role: { type: DataTypes.STRING(20), defaultValue: 'user' },
  status: { type: DataTypes.STRING(20), defaultValue: 'active' },
  balance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  // 待存余额：卖出收入先进这里，买家确认收货 24h 后自动解冻到 balance
  pendingBalance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0, field: 'pending_balance' }
}, { tableName: 'users' })

export const Hotspot = sequelize.define('Hotspot', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, field: 'user_id' },
  title: { type: DataTypes.STRING(200), allowNull: false },
  tag: { type: DataTypes.STRING(50), defaultValue: '分享' },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  author: { type: DataTypes.STRING(50), defaultValue: '' },
  sortOrder: { type: DataTypes.INTEGER, defaultValue: 0, field: 'sort_order' },
  status: { type: DataTypes.STRING(20), defaultValue: 'active' }
}, { tableName: 'hotspots' })

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
  edition: { type: DataTypes.STRING(50), defaultValue: '' },
  delivery: { type: DataTypes.BOOLEAN, defaultValue: true },
  originalPrice: { type: DataTypes.DECIMAL(10, 2), field: 'original_price', defaultValue: 0 },
  // 交易方式：sell 出售 / rent 出租。目前只有「出行」类目会用到，其余类目一律 sell
  dealType: { type: DataTypes.STRING(10), field: 'deal_type', defaultValue: 'sell' }
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
  status: { type: DataTypes.STRING(20), defaultValue: 'pending' },
  // 售后状态与 AfterSale.status 保持同步
  aftersaleStatus: { type: DataTypes.STRING(30), defaultValue: 'none', field: 'aftersale_status' },
  completedAt: { type: DataTypes.DATE, field: 'completed_at' }
}, { tableName: 'orders' })

export const OrderItem = sequelize.define('OrderItem', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderId: { type: DataTypes.INTEGER, allowNull: false, field: 'order_id' },
  productId: { type: DataTypes.INTEGER, allowNull: false, field: 'product_id' },
  sellerId: { type: DataTypes.INTEGER, allowNull: false, field: 'seller_id' },
  price: { type: DataTypes.DECIMAL(10, 2), allowNull: false }
}, { tableName: 'order_items' })

export const AfterSale = sequelize.define('AfterSale', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  orderId: { type: DataTypes.INTEGER, allowNull: false, field: 'order_id' },
  buyerId: { type: DataTypes.INTEGER, allowNull: false, field: 'buyer_id' },
  sellerId: { type: DataTypes.INTEGER, field: 'seller_id' },
  // refund_only 仅退款 / return_refund 退货退款
  type: { type: DataTypes.STRING(20), defaultValue: 'refund_only' },
  amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
  reason: { type: DataTypes.TEXT },
  // pending 待管理员审核 / rejected 管理员已驳回 / seller_pending 待卖家处理
  // seller_rejected 卖家已拒绝待管理员审核 / seller_reject_approved 管理员同意卖家拒绝（买家可申诉一次）
  // appealed 买家申诉中 / refunded 已退款 / closed 终局（申诉被驳回）
  status: { type: DataTypes.STRING(30), defaultValue: 'pending' },
  adminId: { type: DataTypes.INTEGER, field: 'admin_id' },
  adminNote: { type: DataTypes.STRING(500), defaultValue: '', field: 'admin_note' },
  rejectReason: { type: DataTypes.STRING(500), defaultValue: '', field: 'reject_reason' },
  appealReason: { type: DataTypes.TEXT, field: 'appeal_reason' },
  appealed: { type: DataTypes.BOOLEAN, defaultValue: false },
  refundedAt: { type: DataTypes.DATE, field: 'refunded_at' },
  handledAt: { type: DataTypes.DATE, field: 'handled_at' }
}, { tableName: 'after_sales' })

export const UserBehavior = sequelize.define('UserBehavior', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  // search 搜索 / click 浏览点击
  type: { type: DataTypes.STRING(20), allowNull: false },
  keyword: { type: DataTypes.STRING(120), defaultValue: '' },
  category: { type: DataTypes.STRING(30), defaultValue: '' },
  productId: { type: DataTypes.INTEGER, field: 'product_id' }
}, { tableName: 'user_behaviors' })

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

export const PlazaPost = sequelize.define('PlazaPost', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  content: { type: DataTypes.TEXT },
  // 图片路径数组，JSON 字符串存储（最多 6 张）
  // 注意：MySQL 5.7 的 TEXT 列不支持 DEFAULT，默认值在控制器里兜底
  images: { type: DataTypes.TEXT },
  status: { type: DataTypes.STRING(20), defaultValue: 'active' }
}, { tableName: 'plaza_posts' })

// 广场帖子的回复：一条帖子多条回复，删除帖子时一并清理
export const PlazaReply = sequelize.define('PlazaReply', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  postId: { type: DataTypes.INTEGER, allowNull: false, field: 'post_id' },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  content: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.STRING(20), defaultValue: 'active' }
}, { tableName: 'plaza_replies' })

export const Notification = sequelize.define('Notification', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  type: { type: DataTypes.STRING(50), allowNull: false },
  content: { type: DataTypes.TEXT, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_read' }
}, { tableName: 'notifications' })

export const BalanceLog = sequelize.define('BalanceLog', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  // 类型：recharge 充值 / pay 下单扣款 / income 卖出收入 / admin 管理员调整 / refund 退款
  type: { type: DataTypes.STRING(20), allowNull: false },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  balanceAfter: { type: DataTypes.DECIMAL(10, 2), allowNull: false, field: 'balance_after' },
  orderId: { type: DataTypes.INTEGER, field: 'order_id', allowNull: true },
  note: { type: DataTypes.STRING(255), defaultValue: '' },
  // 待存解冻用：pending_after 记录待存余额快照，release_at 到达时间，released 是否已解冻
  pendingAfter: { type: DataTypes.DECIMAL(10, 2), field: 'pending_after' },
  releaseAt: { type: DataTypes.DATE, field: 'release_at' },
  released: { type: DataTypes.BOOLEAN, defaultValue: false }
}, { tableName: 'balance_logs' })
User.hasMany(BalanceLog, { foreignKey: 'user_id', as: 'balanceLogs' })
BalanceLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' })
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
Order.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' })
User.hasMany(Order, { foreignKey: 'buyer_id', as: 'orders' })

AfterSale.belongsTo(Order, { foreignKey: 'order_id', as: 'order' })
AfterSale.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' })
AfterSale.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' })
AfterSale.belongsTo(User, { foreignKey: 'admin_id', as: 'admin' })
Order.hasOne(AfterSale, { foreignKey: 'order_id', as: 'aftersale' })

User.hasMany(UserBehavior, { foreignKey: 'user_id', as: 'behaviors' })
UserBehavior.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

User.hasMany(Favorite, { foreignKey: 'user_id', as: 'favorites' })
Favorite.belongsTo(User, { foreignKey: 'user_id', as: 'user' })
Favorite.belongsTo(Product, { foreignKey: 'product_id', as: 'product' })

User.hasMany(Message, { foreignKey: 'sender_id', as: 'sentMessages' })
User.hasMany(Message, { foreignKey: 'receiver_id', as: 'receivedMessages' })
Message.belongsTo(Product, { foreignKey: 'product_id', as: 'product' })

User.hasMany(Hotspot, { foreignKey: 'user_id', as: 'hotspots' })
Hotspot.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

User.hasMany(PlazaPost, { foreignKey: 'user_id', as: 'plazaPosts' })
PlazaPost.belongsTo(User, { foreignKey: 'user_id', as: 'author' })

// 帖子 ↔ 回复
PlazaPost.hasMany(PlazaReply, { foreignKey: 'post_id', as: 'replies', onDelete: 'CASCADE' })
PlazaReply.belongsTo(PlazaPost, { foreignKey: 'post_id', as: 'post' })
PlazaReply.belongsTo(User, { foreignKey: 'user_id', as: 'author' })

export const Book = sequelize.define('Book', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  isbn: { type: DataTypes.STRING(20), defaultValue: '' },
  bookTitle: { type: DataTypes.STRING(200), allowNull: false, field: 'book_title' },
  bookAuthor: { type: DataTypes.STRING(200), field: 'book_author', defaultValue: '' },
  bookPublisher: { type: DataTypes.STRING(200), field: 'book_publisher', defaultValue: '' },
  bookCover: { type: DataTypes.STRING(500), field: 'book_cover', defaultValue: '' },
  edition: { type: DataTypes.STRING(50), defaultValue: '' },
  originalPrice: { type: DataTypes.DECIMAL(10, 2), field: 'original_price', defaultValue: 0 },
  description: { type: DataTypes.TEXT, defaultValue: '' },
  viewCount: { type: DataTypes.INTEGER, defaultValue: 0, field: 'view_count' },
  createdBy: { type: DataTypes.INTEGER, field: 'created_by' }
}, { tableName: 'books' })

export const BookFavorite = sequelize.define('BookFavorite', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.INTEGER, allowNull: false, field: 'user_id' },
  bookId: { type: DataTypes.INTEGER, allowNull: false, field: 'book_id' }
}, { tableName: 'book_favorites' })

export const Conversation = sequelize.define('Conversation', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  buyerId: { type: DataTypes.INTEGER, allowNull: false, field: 'buyer_id' },
  sellerId: { type: DataTypes.INTEGER, allowNull: false, field: 'seller_id' },
  productId: { type: DataTypes.INTEGER, field: 'product_id' },
  lastMessageAt: { type: DataTypes.DATE, field: 'last_message_at' },
  // normal 普通对话 / admin 联系管理员的客服对话（前端显示「管理员」）
  type: { type: DataTypes.STRING(10), defaultValue: 'normal' }
}, { tableName: 'conversations' })

export const ChatMessage = sequelize.define('ChatMessage', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  conversationId: { type: DataTypes.INTEGER, allowNull: false, field: 'conversation_id' },
  senderId: { type: DataTypes.INTEGER, allowNull: false, field: 'sender_id' },
  content: { type: DataTypes.TEXT, allowNull: false },
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_read' }
}, { tableName: 'chat_messages' })

User.hasMany(Conversation, { foreignKey: 'buyer_id', as: 'buyerConversations' })
User.hasMany(Conversation, { foreignKey: 'seller_id', as: 'sellerConversations' })
Conversation.belongsTo(User, { foreignKey: 'buyer_id', as: 'buyer' })
Conversation.belongsTo(User, { foreignKey: 'seller_id', as: 'seller' })
Conversation.belongsTo(Product, { foreignKey: 'product_id', as: 'product' })
Conversation.hasMany(ChatMessage, { foreignKey: 'conversation_id', as: 'messages' })
ChatMessage.belongsTo(Conversation, { foreignKey: 'conversation_id', as: 'conversation' })
ChatMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' })

BookFavorite.belongsTo(Book, { foreignKey: 'book_id', as: 'book' })
Book.hasMany(BookFavorite, { foreignKey: 'book_id', as: 'favorites' })
User.hasMany(BookFavorite, { foreignKey: 'user_id', as: 'bookFavorites' })

export { sequelize }