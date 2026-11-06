# PickPage

复制过的东西，不该随着原网页一起消失。

PickPage 是一个只有「悬浮窗 + 列表」的本地网页快照 App：复制一段文字或链接，点悬浮气泡上的「保存快照」，它会在后台抓取来源网页的标题和 meta description，并连同原文一起存在手机本地。

## 功能

- **复制即提醒**：开启悬浮窗后，复制文字或链接，气泡会连续闪几下，并出现一个橙色提醒点。
- **保存网页快照**：点气泡，在弹出的面板里点「保存快照」。App 会请求来源网页，抓取 `<title>` 和 meta description 后写入本地。
- **本地列表**：每条快照展示网页标题、复制的原文、来源链接。
- **404 防失联**：点卡片访问原网页前会先检查链接。请求失败时弹出红色提示「原网页已失效，正在为你展示本地快照」，卡片会保留原网址，并标记为「已失效」。
- **纯本地存储**：快照使用 AsyncStorage 存在本机；没有账号、没有云同步。保存时只向来源网址请求网页标题与摘要。

## 使用

1. 安装 APK，打开 PickPage。
2. 点右上角「悬浮窗 关」→ 授予「显示在其他应用上层」权限。
3. 在任意 App 复制一段文字或链接。
4. 点屏幕边缘的绿色气泡 → 点「保存快照」。
5. 回到 PickPage 查看列表；点卡片可以检查并打开原网页。

长按气泡可关闭悬浮窗；长按列表卡片可删除该条快照。

## 技术结构

- `App.tsx`：列表、悬浮窗开关、404 检查、红色提示。
- `src/lib/url.ts`：链接提取、网页标题 / meta description 抓取、链接存活检查。
- `src/storage.ts`：本地快照读写。
- `modules/floating-memo/`：Android 悬浮气泡、剪贴板监听、保存面板与前台服务。

## 开发 / 打包

```bash
npm install
npx expo prebuild --platform android
npx tsc --noEmit
cd android
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

APK 输出：`android/app/build/outputs/apk/release/app-release.apk`

## 已知限制

- 安卓 10+ 对后台读取剪贴板有限制。部分系统上，只有 App 在前台时监听才稳定；这是系统行为，不是 App 能绕过的。
- 某些网站会拦截 App 发出的请求，或需要登录 / JavaScript 才能渲染。此时快照仍会保存，只是标题会使用本地原文兜底。
- 网页返回 200 但内容实际是「404 页面」的情况，无法仅通过 HTTP 状态码识别。
- 将 App 从后台强制划掉后，悬浮窗和监听会停止；重新打开 App 即可恢复。
