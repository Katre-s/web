# 文衡 App - Android APK 打包说明

本工程已配置好 Capacitor 8（`web/android/` 目录），只需用 Android Studio 打开并构建即可得到 APK。

## 一、APK 原理

App 采用**远程加载模式**（见 `web/capacitor.config.json`）：

```json
{
  "appId": "com.wenheng.campus",
  "appName": "文衡",
  "webDir": "dist",
  "server": {
    "url": "http://121.40.219.139",
    "cleartext": true,
    "androidScheme": "http"
  }
}
```

- App 启动后直接加载服务器上的最新网页，**网站更新后 App 无需重新打包**
- 服务器地址变更时，修改 `server.url` 后重新执行 `npx cap sync android` 并重新打包

## 二、环境准备（一次性）

1. 安装 **JDK 17+**（推荐 Temurin：https://adoptium.net）
2. 安装 **Android Studio**（https://developer.android.com/studio）
3. Android Studio → Settings → Languages & Frameworks → Android SDK，确认安装了 **SDK Platform (API 35+)** 和 **Android SDK Build-Tools**

## 三、打包步骤

```bash
# 1. （仅网页有改动时）重新构建前端并同步
cd web
npx vite build
npx cap sync android

# 2. 用 Android Studio 打开工程
#    File → Open → 选择 web/android 目录
#    等待 Gradle Sync 完成（首次较慢）

# 3. 菜单 Build → Build App Bundle(s) / APK(s) → Build APK(s)
```

APK 输出路径：
```
web/android/app/build/outputs/apk/debug/app-debug.apk
```

`app-debug.apk` 可直接发给学生安装（需在手机上允许"安装未知来源应用"）。

## 四、正式发布签名（可选）

调试 APK 足够日常分发。若需上架或长期使用，建议生成签名版本：

1. Android Studio 菜单 **Build → Generate Signed Bundle / APK → APK**
2. 点 **Create new...** 生成 keystore（妥善保管，丢失无法升级覆盖安装）
3. 选择 **release**，完成后得到 `app-release.apk`

命令行方式（配好签名后）：
```bash
cd web/android
./gradlew assembleRelease
```

## 五、常见问题

| 问题 | 解决方案 |
|------|----------|
| Gradle Sync 失败/下载慢 | `android/gradle.properties` 中加代理，或在 `~/.gradle/init.gradle` 配置国内镜像（腾讯 `mirrors.cloud.tencent.com/nexus/content/repositories/gradle-plugin/`） |
| 手机安装时提示"未知来源" | 设置 → 安全 → 允许安装未知应用 |
| App 内白屏 | 检查服务器 80 端口是否可访问（浏览器打开 http://121.40.219.139 验证） |
| 修改了服务器 IP | 改 `web/capacitor.config.json` 的 `server.url` → `npx cap sync android` → 重新打包 |

## 六、目录结构

```
web/
├── capacitor.config.json     # Capacitor 配置（appId/服务器地址）
├── android/                  # Android 原生工程（Android Studio 打开此目录）
│   └── app/src/main/res/mipmap-*/  # 已替换为文衡图标
└── public/
    ├── manifest.json         # PWA 清单
    ├── sw.js                 # PWA Service Worker
    └── icons/                # PWA 图标（192/512/maskable）
```