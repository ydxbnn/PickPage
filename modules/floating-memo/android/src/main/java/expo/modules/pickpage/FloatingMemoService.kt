package expo.modules.pickpage

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * 前台服务：让悬浮气泡在切到其他 App 后更不容易被系统回收。
 * 若某个 ROM 拒绝前台服务，会退化为普通悬浮窗，不影响核心功能。
 */
class FloatingMemoService : Service() {

  companion object {
    private const val CHANNEL_ID = "pickpage_floating"
    private const val NOTIFICATION_ID = 47101
    private const val CLOSE_REQUEST_CODE = 47103

    fun start(context: Context) {
      try {
        val intent = Intent(context, FloatingMemoService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          context.startForegroundService(intent)
        } else {
          context.startService(intent)
        }
      } catch (_: Exception) {
        // 忽略：前台服务启动失败时，气泡仍可正常使用
      }
    }

    fun stop(context: Context) {
      try {
        context.stopService(Intent(context, FloatingMemoService::class.java))
      } catch (_: Exception) {
        // 忽略
      }
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannel()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    try {
      val notification = buildNotification()
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        startForeground(
          NOTIFICATION_ID,
          notification,
          ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        )
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (_: Exception) {
      try {
        stopSelf()
      } catch (_: Exception) {
        // 忽略
      }
    }
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    try {
      stopForeground(true)
    } catch (_: Exception) {
      // 忽略
    }
    super.onDestroy()
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    try {
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val channel = NotificationChannel(
        CHANNEL_ID,
        "PickPage 悬浮窗",
        NotificationManager.IMPORTANCE_LOW
      ).apply {
        setShowBadge(false)
        description = "保持悬浮气泡运行，随时接住你复制的内容"
      }
      manager.createNotificationChannel(channel)
    } catch (_: Exception) {
      // 忽略
    }
  }

  private fun buildNotification(): Notification {
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this)
    }

    return builder
      .setContentTitle("\uD83D\uDD16 PickPage 已开启")
      .setContentText("复制内容后，点悬浮气泡保存网页快照。")
      .setStyle(
        Notification.BigTextStyle().bigText(
          "【使用须知】不要在后台强制划掉 PickPage，否则悬浮窗会失效。" +
            "【隐私声明】快照只保存在本机；保存时会联网读取原网页的标题与摘要。"
        )
      )
      .setSmallIcon(android.R.drawable.ic_menu_edit)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .addAction(
        Notification.Action.Builder(
          android.R.drawable.ic_menu_close_clear_cancel,
          "关闭悬浮窗",
          closePendingIntent()
        ).build()
      )
      .build()
  }

  private fun closePendingIntent(): PendingIntent {
    val intent = Intent(this, CloseOverlayReceiver::class.java)
    val flags = PendingIntent.FLAG_UPDATE_CURRENT or
      (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) PendingIntent.FLAG_IMMUTABLE else 0)
    return PendingIntent.getBroadcast(this, CLOSE_REQUEST_CODE, intent, flags)
  }
}
