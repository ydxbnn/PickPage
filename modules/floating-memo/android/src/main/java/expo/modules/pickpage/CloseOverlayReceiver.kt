package expo.modules.pickpage

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** 通知栏「关闭悬浮窗」按钮与悬浮层之间的轻量桥。 */
object FloatingMemoBridge {
  @Volatile
  var closeHandler: (() -> Unit)? = null

  fun triggerClose() {
    closeHandler?.invoke()
  }
}

class CloseOverlayReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context?, intent: Intent?) {
    try {
      FloatingMemoBridge.triggerClose()
    } catch (_: Exception) {
      // 忽略
    }
  }
}
