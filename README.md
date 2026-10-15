# 文衡 - 二手书籍交易平台

> 文聚学府，百事通达

## 项目结构
```
campus-trade/
├── web/          # 网站前端（Vue 3 + Vite）
│   ├── src/
│   │   ├── api/          # API 封装
│   │   ├── assets/       # 静态资源
│   │   ├── components/   # 公共组件
│   │   ├── router/       # 路由
│   │   ├── stores/       # Pinia 状态管理
│   │   └── views/        # 页面
│   ├── deploy/           # 宝塔面板部署配置
│   └── package.json
├── server/       # 后端 API（待搭建）
└── app/          # App 端（待搭建）
```

## Web 端快速开始
```bash
cd web
npm install
npm run dev
```

## 核心功能
- ISBN 一键上架（AI 识别书籍信息）
- 书单图片一键导入购物车（OCR + AI 解析）
- 购物车与订单管理
- 求购清单
- 学生登录注册

## 技术栈
- Vue 3 + Vite + Pinia + Vue Router
- Element Plus
- Axios