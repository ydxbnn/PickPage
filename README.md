# PickPage（拾页）

复制过的东西，不该随着原网页一起消失。

PickPage 是一个纯本地网页快照 App。它直接在手机端抓取网页正文、降噪并生成摘要，不再依赖 Python、Termux 或本地 8080 后端。

## 功能

- **设备端抓取**：`axios + cheerio` 直接请求网页，随机 User-Agent，清理 `script/style/nav/footer` 等噪音，提取 `<p>` 正文并截取 300～500 字。
- **一键剪贴板总结**：复制链接后回到 App，点「从剪贴板抓取」或「一键读取剪贴板并总结」，自动抓取并调用 AI。
- **查看原文**：每条历史快照底部都有「查看原文 ↗」，直接调用系统浏览器打开来源链接。
- **反爬兜底**：知乎请求自动附加 `Referer: https://www.zhihu.com/`；遇到 403/429 等拦截时自动打开系统浏览器，并在弹窗提供「去浏览器打开」按钮。
- **防后台被杀**：`AppState` 回到前台时检测剪贴板新链接；URL 草稿、快照列表、AI 配置会自动恢复。
- **极简模式**：设置里可切换，只保留巨大的「一键读取剪贴板并总结」按钮和最近一次总结。
- **AI 总结**：默认 DeepSeek：
  - Base URL：`https://api.deepseek.com/v1`
  - 模型：`deepseek-chat`
  - 极简模式不显示思考深度或模型选择参数，只需要填一次 API Key。
- **本地优先**：快照存在 AsyncStorage；API Key 存在 SecureStore（Android Keystore），不写入明文存储。

## 使用

1. 安装 APK，打开 PickPage。
2. 在设置中填入一次 API Key；Base URL 和模型默认已填好。
3. 复制网页链接。
4. 回到 App：
   - 极客模式：点「从剪贴板抓取」，或粘贴到 URL 输入框后点「抓取」。
   - 极简模式：点「一键读取剪贴板并总结」。
5. 查看最近总结或历史快照；点「查看原文」回到原网页。

开启悬浮窗后，也可以复制内容并从悬浮气泡的「保存快照」进入。

## 抓取状态

- `SUCCESS`：正文抓取成功，才会调用 AI。
- `EMPTY_BODY`：正文为空，通常是动态加载页面。
- `BLOCKED`：401/403/407/429/451 等反爬拦截，自动打开系统浏览器。
- `NETWORK_ERROR`：404/5xx/超时/断网等网络错误。

## 目录

- `App.tsx`：主界面、极简/极客模式、剪贴板恢复、快照列表。
- `src/lib/scraper.ts`：纯 TypeScript 网页抓取、降噪和状态分类。
- `src/lib/backend.ts`：抓取器适配层。
- `src/lib/ai.ts`：AI 配置与 Chat Completions 调用。
- `src/lib/url.ts`：链接提取与网页元数据。
- `src/storage.ts`：快照、URL 草稿、极简模式和用户模式持久化。
- `src/components/SnapshotCard.tsx`：快照卡片和「查看原文」。
- `src/components/SettingsModal.tsx`：API Key 与极简模式设置。
- `src/components/FaqModal.tsx`：FAQ 与新手教程。
- `modules/floating-memo/`：Android 悬浮气泡与剪贴板监听。

## 开发

```bash
npm ci
npx tsc --noEmit
npx expo export --platform android --no-bytecode
```

## 打包

推荐使用 GitHub Actions：

```text
.github/workflows/build-android.yml
```

云端执行 `expo prebuild` 和 `./gradlew assembleRelease`，APK 从 Actions 页面的 Artifacts 下载。

本地需要 Android SDK、JDK 17 和足够内存：

```bash
npx expo prebuild --platform android
cd android
./gradlew assembleRelease
```

产物：

```text
android/app/build/outputs/apk/release/app-release.apk
```

## 已知限制

- Android 10+ 限制后台读取剪贴板，因此主界面提供前台「一键抓取」作为兜底。
- 动态渲染页面可能返回 `EMPTY_BODY`，App 不会对空正文调用 AI。
- 部分站点即使伪造请求头仍会拦截；此时会自动打开浏览器，由用户手动复制正文。
- 未配置 GitHub Secrets 时，Release APK 使用 debug keystore 签名，不能覆盖 EAS 正式签名包，需要先卸载旧版。
