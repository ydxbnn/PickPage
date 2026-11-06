package expo.modules.pickpage

import android.content.ClipboardManager
import android.content.Context
import android.os.Handler
import android.os.HandlerThread
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class FloatingMemoModule : Module() {
  private var overlay: FloatingMemoOverlay? = null

  private var clipboardManager: ClipboardManager? = null
  private var clipboardListener: ClipboardManager.OnPrimaryClipChangedListener? = null
  private var clipboardContext: Context? = null
  private var lastClipboardContent: String? = null
  private val clipboardHandler = Handler(Looper.getMainLooper())
  private var pendingClipRead: Runnable? = null

  private val clipboardThread = HandlerThread("pickpage-clipboard").apply { start() }
  private val clipboardBgHandler = Handler(clipboardThread.looper)

  private fun getOverlay(): FloatingMemoOverlay {
    overlay?.let { return it }
    val ctx = appContext.reactContext?.applicationContext
      ?: throw IllegalStateException("React application context is not available yet.")
    val instance = FloatingMemoOverlay(
      context = ctx,
      onSnapshot = { text ->
        sendEvent("onSnapshot", mapOf("text" to text))
      },
      onDismiss = { reason ->
        sendEvent("onDismiss", mapOf("reason" to reason))
      }
    )
    overlay = instance
    FloatingMemoBridge.closeHandler = {
      instance.hide()
      sendEvent("onDismiss", mapOf("reason" to "notificationAction"))
    }
    return instance
  }

  override fun definition() = ModuleDefinition {
    Name("FloatingMemo")

    Events("onSnapshot", "onDismiss", "onClipboard")

    AsyncFunction("hasOverlayPermission") {
      getOverlay().hasPermission()
    }

    AsyncFunction("requestOverlayPermission") {
      getOverlay().requestPermission()
    }

    AsyncFunction("show") {
      val instance = getOverlay()
      if (!instance.hasPermission()) {
        return@AsyncFunction false
      }
      instance.show()
      return@AsyncFunction true
    }

    AsyncFunction("hide") {
      getOverlay().hide()
    }

    AsyncFunction("isShowing") {
      getOverlay().isShowing()
    }

    AsyncFunction("setDarkMode") { dark: Boolean ->
      getOverlay().setDarkMode(dark)
    }

    AsyncFunction("startClipboardWatcher") {
      startClipboardWatcher()
    }

    AsyncFunction("stopClipboardWatcher") {
      stopClipboardWatcher()
    }

    OnDestroy {
      FloatingMemoBridge.closeHandler = null
      stopClipboardWatcher()
      try {
        clipboardThread.quitSafely()
      } catch (_: Exception) {
        // 忽略
      }
      overlay?.destroy()
    }
  }

  private fun startClipboardWatcher() {
    try {
      if (clipboardListener != null) return
      val ctx = appContext.reactContext ?: return
      val manager = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as? ClipboardManager ?: return
      clipboardContext = ctx
      clipboardManager = manager
      val listener = object : ClipboardManager.OnPrimaryClipChangedListener {
        override fun onPrimaryClipChanged() {
          scheduleClipboardRead()
        }
      }
      clipboardListener = listener
      manager.addPrimaryClipChangedListener(listener)
    } catch (_: Exception) {
      // 某些定制系统会限制剪贴板监听，静默失败即可。
    }
  }

  private fun stopClipboardWatcher() {
    try {
      clipboardListener?.let { clipboardManager?.removePrimaryClipChangedListener(it) }
    } catch (_: Exception) {
      // 忽略
    }
    clipboardListener = null
    pendingClipRead?.let { clipboardHandler.removeCallbacks(it) }
    pendingClipRead = null
  }

  /** 防抖：连续复制时只处理最后一次，并切到后台线程读取。 */
  private fun scheduleClipboardRead() {
    try {
      pendingClipRead?.let { clipboardHandler.removeCallbacks(it) }
      val runnable = Runnable {
        clipboardBgHandler.post { readClipboardNow() }
      }
      pendingClipRead = runnable
      clipboardHandler.postDelayed(runnable, 450L)
    } catch (_: Exception) {
      // 忽略
    }
  }

  private fun readClipboardNow() {
    try {
      val manager = clipboardManager ?: return
      val clip = manager.primaryClip ?: return
      if (clip.itemCount <= 0) return
      val ctx = clipboardContext ?: return
      val text = clip.getItemAt(0)?.coerceToText(ctx)?.toString()?.trim().orEmpty()
      if (text.isEmpty()) return

      if (text == lastClipboardContent) return
      lastClipboardContent = text

      overlay?.captureClipboard(text)
      sendEvent("onClipboard", mapOf("text" to text))
    } catch (_: Exception) {
      // Android 10+ 后台读取可能被系统拒绝，静默失败。
    }
  }
}
