# 文衡 App - Android APK 打包说明

工程已配置好 Capacitor 8（`web/android/` 目录）。**当前是「内嵌本地资源 + 优先加载线上」的混合模式**，
不需要 Android Studio 也能用命令行打出 APK（需要 JDK 17+ 与 Android SDK）。

## 一、运行机制（很重要）

`web/capacitor.config.json` 里**没有** `server.url`，也就是 App 把前端打进安装包（`assets/public/`），
启动时按这个顺序工作：

1. 先加载内置包（断网也能开，不会白屏）
2. 内置包里的 `main.js` 会探测 `VITE_REMOTE_SHELL` 的 `/api/health`（2.5 秒超时）
3. 通 → 跳到线上 `http://121.40.219.139`，**以后网页更新，App 自动就是最新，不用重装**
4. 不通（没网/服务器挂了）→ 继续用内置包，不跳转

也就是说：**平时改网页不用重新打包**；只有改原生配置、换服务器地址、改图标/权限时才需要重新出 APK。

## 二、环境准备（一次性）

1. **JDK 17+**（本机是 JDK 21，已验证可编译）
2. **Android SDK**（`web/android/local.properties` 里的 `sdk.dir` 指向 SDK 路径）
3. Gradle 首次会自动下载（本机已缓存在 `~/.gradle`）

## 三、打包步骤（命令行，推荐）

```bash
cd web

# 1. 构建「移动端模式」前端（关键：不能用 npm run build！）
npm run build:mobile          # vite build --mode mobile，读 .env.mobile

# 2. 同步到安卓工程（把 dist 拷进 android/app/src/main/assets/public）
npx cap sync android

# 3. 打包 APK
cd android
gradlew.bat assembleDebug     # Windows；macOS/Linux 用 ./gradlew assembleDebug
```

产物：`web/android/app/build/outputs/apk/debug/app-debug.apk`

`app-debug.apk` 可直接发给同学安装（手机需允许"安装未知来源应用"）。

> **为什么必须用 `build:mobile`**：WebView 里页面源是 `https://localhost`，相对 `/api` 指不到服务器。
> `.env.mobile` 把接口写成绝对地址 `http://121.40.219.139:3000/api`；用普通 `build` 打出来的 APK 会**接口全挂、图片全白**。

## 四、版本与发布

- 版本号在 `web/android/app/build.gradle`：`versionCode`（每次必须 +1）、`versionName`
- 当前版本：`versionCode 2` / `versionName 1.1`
- 上架或长期分发建议做签名（`Build → Generate Signed Bundle / APK`），keystore 务必备份

## 五、常见问题

| 现象 | 原因 / 解决 |
| --- | --- |
| App 里作者/出版社显示成英文（`bookdetail.authorPrefix` 之类） | 装的是**旧 APK**，内置包还是修复前的代码。用 `build:mobile` + `cap sync` + `assembleDebug` 重新打包 |
| App 里所有图片都是白块 | 同上，旧包里图片路径没处理；或 `.env.mobile` 的 `VITE_API_ORIGIN` 不是可访问地址 |
| App 打开是空白页 | 先看手机能不能打开 `http://121.40.219.139`；服务器正常时若仍白屏，检查是否用了普通 `npm run build` |
| 改了网页但 App 还是旧界面 | 正常应自动跳线上最新版；若没跳，检查 `VITE_REMOTE_SHELL` 是否配置、服务器 80 端口是否通 |
| 想彻底只用内置包 | 把 `web/.env.mobile` 里的 `VITE_REMOTE_SHELL` 留空，重新打包 |
| Gradle 下载慢 / Sync 失败 | 在 `~/.gradle/init.gradle` 配国内镜像（腾讯 `mirrors.cloud.tencent.com/nexus/content/repositories/gradle-plugin/`） |
| 安装提示"未知来源" | 设置 → 安全 → 允许安装未知应用 |

## 六、目录结构

```
web/
├── .env.mobile                 # 移动端构建配置（绝对接口地址 + 线上壳地址）
├── capacitor.config.json       # appId/appName/webDir，无 server.url（内嵌模式）
├── android/                    # 原生工程
│   ├── app/build.gradle        # versionCode / versionName
│   ├── app/src/main/assets/public/   # cap sync 拷进去的前端产物
│   └── app/build/outputs/apk/debug/app-debug.apk
└── public/
    ├── manifest.json           # PWA 清单
    ├── sw.js                   # Service Worker（网页端）
    └── icons/                  # 图标
```

## 七、三种构建的区别（别用错）

| 目标 | 命令 | 接口地址 | 产物 |
| --- | --- | --- | --- |
| 网页部署 | `npm run build` | 同源 `/api` | `web/dist` → 上传服务器 |
| 安卓 App | `npm run build:mobile` | `http://121.40.219.139:3000/api` | `cap sync` 后再 gradle 打包 |
| 电脑端 | `npm run build:desktop` | 绝对地址（app:// 壳） | `desktop/release/*.exe` |

> 三种构建都会覆盖 `web/dist`，**打包前确认用对了 mode**，否则会把网页版配置打进 App。
