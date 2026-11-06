package expo.modules.pickpage

import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.text.TextUtils
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.ViewConfiguration
import android.view.ViewGroup
import android.view.WindowManager
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast

/**
 * 悬浮气泡：
 * 复制内容后出现提醒点并脉冲提示；点气泡打开「保存快照」面板。
 * 面板只负责把内容交回 JS，抓网页与落盘都由 JS 完成。
 */
class FloatingMemoOverlay(
  private val context: Context,
  private val onSnapshot: (String) -> Unit,
  private val onDismiss: (String) -> Unit
) {
  companion object {
    private const val PREFS = "pickpage_overlay"
    private const val KEY_X = "bubble_x"
    private const val KEY_Y = "bubble_y"

    private const val BUBBLE_SIZE_DP = 56
    private const val BUBBLE_MARGIN_DP = 8
    private const val GRADIENT_START = "#4F9B82"
    private const val GRADIENT_END = "#2E6B5A"
    private const val DOT_COLOR = "#FF7043"
  }

  private val windowManager: WindowManager =
    context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
  private val mainHandler = Handler(Looper.getMainLooper())
  private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  private var bubbleView: View? = null
  private var bubbleDot: View? = null
  private var bubbleParams: WindowManager.LayoutParams? = null
  private var inputView: View? = null
  private var inputCard: View? = null

  @Volatile private var pendingClipboard: String? = null
  private var pulseRemaining = 0
  private var pulseAnimating = false

  @Volatile private var showing = false
  @Volatile private var darkMode = false

  private var lastX = prefs.getInt(KEY_X, screenWidth() - dp(BUBBLE_SIZE_DP + BUBBLE_MARGIN_DP * 2))
  private var lastY = prefs.getInt(KEY_Y, dp(200))

  // ---- 权限 ----

  fun hasPermission(): Boolean {
    return Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
      Settings.canDrawOverlays(context)
  }

  fun requestPermission(): Boolean {
    if (hasPermission()) return true
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:${context.packageName}")
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
      } catch (_: Exception) {
        // 忽略
      }
    }
    return false
  }

  // ---- 对外控制 ----

  fun isShowing(): Boolean = showing

  fun setDarkMode(dark: Boolean) {
    darkMode = dark
  }

  fun show() {
    if (showing) return
    showing = true
    mainHandler.post { addBubble() }
  }

  fun hide() {
    showing = false
    pendingClipboard = null
    FloatingMemoService.stop(context)
    mainHandler.post { removeAll() }
  }

  fun destroy() {
    hide()
  }

  /** 剪贴板有新内容：保留待保存文本，亮起提醒点并让气泡闪一下。 */
  fun captureClipboard(text: String) {
    val value = text.trim()
    if (value.isEmpty()) return
    mainHandler.post {
      pendingClipboard = value
      val dot = bubbleDot
      if (dot != null) dot.visibility = View.VISIBLE
      pulseBubble(3)
    }
  }

  // ---- 气泡 ----

  private fun addBubble() {
    if (bubbleView != null) return
    if (!hasPermission()) return

    val bubbleSize = dp(BUBBLE_SIZE_DP)
    val margin = dp(BUBBLE_MARGIN_DP)
    val windowSize = bubbleSize + margin * 2

    val container = FrameLayout(context)

    val shadow = View(context).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.parseColor("#2E000000"))
      }
    }
    container.addView(
      shadow,
      FrameLayout.LayoutParams(bubbleSize, bubbleSize, Gravity.CENTER).apply {
        topMargin = dp(4)
      }
    )

    val bubble = TextView(context).apply {
      text = "\uD83D\uDD16" // 🔖
      textSize = 22f
      gravity = Gravity.CENTER
      includeFontPadding = false
      setTextColor(Color.WHITE)
      background = GradientDrawable(
        GradientDrawable.Orientation.TL_BR,
        intArrayOf(Color.parseColor(GRADIENT_START), Color.parseColor(GRADIENT_END))
      ).apply {
        shape = GradientDrawable.OVAL
        setStroke(dp(2), Color.parseColor("#40FFFFFF"))
      }
    }
    container.addView(bubble, FrameLayout.LayoutParams(bubbleSize, bubbleSize, Gravity.CENTER))

    val dot = View(context).apply {
      background = GradientDrawable().apply {
        shape = GradientDrawable.OVAL
        setColor(Color.parseColor(DOT_COLOR))
        setStroke(dp(2), Color.WHITE)
      }
      visibility = if (pendingClipboard != null) View.VISIBLE else View.GONE
    }
    container.addView(
      dot,
      FrameLayout.LayoutParams(dp(13), dp(13), Gravity.TOP or Gravity.END).apply {
        topMargin = dp(4)
        rightMargin = dp(4)
      }
    )

    val params = WindowManager.LayoutParams(
      windowSize,
      windowSize,
      overlayType(),
      WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.TOP or Gravity.START
      x = clampX(lastX)
      y = clampY(lastY)
    }

    attachDrag(container, params)

    container.scaleX = 0.2f
    container.scaleY = 0.2f
    container.alpha = 0f

    bubbleView = container
    bubbleDot = dot
    bubbleParams = params
    try {
      windowManager.addView(container, params)
      container.animate()
        .scaleX(1f)
        .scaleY(1f)
        .alpha(1f)
        .setDuration(260L)
        .setInterpolator(OvershootInterpolator(1.4f))
        .start()
      FloatingMemoService.start(context)
    } catch (_: Exception) {
      bubbleView = null
      bubbleDot = null
      bubbleParams = null
    }
  }

  private fun pulseBubble(times: Int) {
    mainHandler.post {
      pulseRemaining = maxOf(pulseRemaining, times)
      if (!pulseAnimating) animateNextPulse()
    }
  }

  private fun animateNextPulse() {
    val view = bubbleView
    if (view == null || pulseRemaining <= 0) {
      pulseAnimating = false
      return
    }
    pulseAnimating = true
    view.animate().cancel()
    view.animate()
      .scaleX(1.16f)
      .scaleY(1.16f)
      .setDuration(120L)
      .withEndAction {
        if (bubbleView !== view) {
          pulseAnimating = false
          return@withEndAction
        }
        view.animate()
          .scaleX(1f)
          .scaleY(1f)
          .setDuration(160L)
          .withEndAction {
            if (bubbleView !== view) {
              pulseAnimating = false
              return@withEndAction
            }
            pulseRemaining -= 1
            if (pulseRemaining > 0) animateNextPulse() else pulseAnimating = false
          }
          .start()
      }
      .start()
  }

  private fun attachDrag(bubble: View, params: WindowManager.LayoutParams) {
    val touchSlop = ViewConfiguration.get(context).scaledTouchSlop
    var downRawX = 0f
    var downRawY = 0f
    var startX = 0
    var startY = 0
    var moved = false
    var dismissing = false
    var longPress: Runnable? = null

    fun cancelLongPress() {
      longPress?.let { bubble.removeCallbacks(it) }
      longPress = null
    }

    bubble.setOnTouchListener { _, event ->
      when (event.actionMasked) {
        MotionEvent.ACTION_DOWN -> {
          downRawX = event.rawX
          downRawY = event.rawY
          startX = params.x
          startY = params.y
          moved = false
          dismissing = false
          cancelLongPress()
          val runnable = Runnable {
            if (!moved && bubbleView === bubble) {
              dismissing = true
              dismissBubbleWithAnimation()
            }
          }
          longPress = runnable
          bubble.postDelayed(runnable, 520L)
          true
        }
        MotionEvent.ACTION_MOVE -> {
          val dx = event.rawX - downRawX
          val dy = event.rawY - downRawY
          if (!moved && Math.hypot(dx.toDouble(), dy.toDouble()) > touchSlop) {
            moved = true
            cancelLongPress()
          }
          if (moved) {
            params.x = startX + dx.toInt()
            params.y = startY + dy.toInt()
            try {
              windowManager.updateViewLayout(bubble, params)
            } catch (_: Exception) {
              // 忽略
            }
          }
          true
        }
        MotionEvent.ACTION_UP -> {
          cancelLongPress()
          if (!dismissing && bubbleView === bubble) {
            if (moved) {
              lastX = params.x
              lastY = params.y
              prefs.edit().putInt(KEY_X, lastX).putInt(KEY_Y, lastY).apply()
            } else {
              openSnapshotPanel()
            }
          }
          true
        }
        MotionEvent.ACTION_CANCEL -> {
          cancelLongPress()
          false
        }
        else -> false
      }
    }
  }

  private fun hideBubble() {
    val view = bubbleView ?: return
    view.animate().cancel()
    try {
      windowManager.removeView(view)
    } catch (_: Exception) {
      // 忽略
    }
    bubbleView = null
    bubbleDot = null
    bubbleParams = null
    pulseAnimating = false
    pulseRemaining = 0
  }

  private fun showBubble() {
    if (bubbleView != null) return
    if (!showing) return
    addBubble()
  }

  private fun dismissBubbleWithAnimation() {
    val view = bubbleView ?: return
    showing = false
    pendingClipboard = null
    view.animate()
      .scaleX(0.2f)
      .scaleY(0.2f)
      .alpha(0f)
      .setDuration(180L)
      .setInterpolator(DecelerateInterpolator())
      .withEndAction {
        if (bubbleView === view) hideBubble()
        FloatingMemoService.stop(context)
        onDismiss("longPress")
      }
      .start()
  }

  // ---- 保存快照浮层 ----

  private fun openSnapshotPanel() {
    if (inputView != null) return
    hideBubble()

    val root = buildSnapshotOverlay()
    val params = WindowManager.LayoutParams(
      WindowManager.LayoutParams.MATCH_PARENT,
      WindowManager.LayoutParams.MATCH_PARENT,
      overlayType(),
      WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
      PixelFormat.TRANSLUCENT
    ).apply {
      gravity = Gravity.CENTER
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        flags = flags or WindowManager.LayoutParams.FLAG_BLUR_BEHIND
        blurBehindRadius = dp(18)
      }
    }

    try {
      windowManager.addView(root, params)
      inputView = root
      root.alpha = 0f
      root.animate().alpha(1f).setDuration(170L).start()

      inputCard?.let { card ->
        card.scaleX = 0.92f
        card.scaleY = 0.92f
        card.animate()
          .scaleX(1f)
          .scaleY(1f)
          .setDuration(220L)
          .setInterpolator(DecelerateInterpolator())
          .start()
      }
    } catch (_: Exception) {
      inputView = null
      showBubble()
    }
  }

  private fun closeInput() {
    val view = inputView ?: return
    try {
      windowManager.removeView(view)
    } catch (_: Exception) {
      // 忽略
    }
    inputView = null
    inputCard = null
    showBubble()
  }

  private fun buildSnapshotOverlay(): View {
    val dark = darkMode
    val cardBg = if (dark) Color.parseColor("#F21E211C") else Color.parseColor("#F7FFFFFF")
    val fg = if (dark) Color.parseColor("#EDEEE8") else Color.parseColor("#20231F")
    val muted = if (dark) Color.parseColor("#9A9F94") else Color.parseColor("#7D8176")
    val previewBg = if (dark) Color.parseColor("#3A2A2E28") else Color.parseColor("#F1EFE8")
    val strokeColor = if (dark) Color.parseColor("#29FFFFFF") else Color.parseColor("#1F000000")

    val root = FrameLayout(context)
    val scrim = View(context).apply {
      setBackgroundColor(Color.parseColor("#66000000"))
      setOnClickListener { closeInput() }
    }
    root.addView(
      scrim,
      FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.MATCH_PARENT
      )
    )

    val card = LinearLayout(context).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(20), dp(18), dp(20), dp(16))
      background = GradientDrawable().apply {
        cornerRadius = dp(22).toFloat()
        setColor(cardBg)
        setStroke(dp(1), strokeColor)
      }
      isClickable = true
      elevation = dp(12).toFloat()
    }
    inputCard = card

    val header = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    val title = TextView(context).apply {
      text = "保存网页快照"
      textSize = 17f
      typeface = Typeface.DEFAULT_BOLD
      setTextColor(fg)
    }
    val close = TextView(context).apply {
      text = "×"
      textSize = 24f
      gravity = Gravity.CENTER
      setTextColor(muted)
      setPadding(dp(10), 0, dp(2), dp(2))
      setOnClickListener { closeInput() }
    }
    header.addView(title, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
    header.addView(close)

    val badge = TextView(context).apply {
      text = " 剪贴板已捕捉 "
      textSize = 11f
      setTextColor(Color.parseColor(GRADIENT_END))
      background = GradientDrawable().apply {
        cornerRadius = dp(9).toFloat()
        setColor(Color.parseColor(if (dark) "#334F9B82" else "#1F4F9B82"))
      }
      setPadding(dp(8), dp(3), dp(8), dp(3))
    }

    val preview = TextView(context).apply {
      val content = pendingClipboard
      text = content ?: "还没有捕捉到新内容。\n先复制一段文字或链接，再点悬浮气泡。"
      textSize = 14f
      setTextColor(if (content != null) fg else muted)
      maxLines = 6
      ellipsize = TextUtils.TruncateAt.END
      setLineSpacing(0f, 1.18f)
      setPadding(dp(14), dp(12), dp(14), dp(12))
      background = GradientDrawable().apply {
        cornerRadius = dp(13).toFloat()
        setColor(previewBg)
      }
    }

    val helper = TextView(context).apply {
      text = if (pendingClipboard != null) {
        "保存后会抓取来源网页的标题与摘要；网页消失，快照仍在。"
      } else {
        "气泡闪一下，就说明有新内容可以留下来了。"
      }
      textSize = 12f
      setTextColor(muted)
      setLineSpacing(0f, 1.15f)
      setPadding(dp(2), dp(9), dp(2), 0)
    }

    val btnRow = LinearLayout(context).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.END
      setPadding(0, dp(12), 0, 0)
    }
    val cancel = TextView(context).apply {
      text = if (pendingClipboard != null) "取消" else "知道了"
      textSize = 15f
      setTextColor(muted)
      setPadding(dp(16), dp(10), dp(16), dp(10))
      setOnClickListener { closeInput() }
    }
    btnRow.addView(cancel)

    if (pendingClipboard != null) {
      val save = TextView(context).apply {
        text = "保存快照"
        textSize = 15f
        typeface = Typeface.DEFAULT_BOLD
        setTextColor(Color.WHITE)
        setPadding(dp(22), dp(11), dp(22), dp(11))
        background = GradientDrawable(
          GradientDrawable.Orientation.TL_BR,
          intArrayOf(Color.parseColor(GRADIENT_START), Color.parseColor(GRADIENT_END))
        ).apply {
          cornerRadius = dp(24).toFloat()
        }
        elevation = dp(4).toFloat()
        setOnClickListener {
          val text = pendingClipboard?.trim().orEmpty()
          if (text.isEmpty()) return@setOnClickListener
          pendingClipboard = null
          closeInput()
          try {
            Toast.makeText(context, "快照已保存，正在补齐网页信息", Toast.LENGTH_SHORT).show()
          } catch (_: Exception) {
            // 忽略
          }
          onSnapshot(text)
        }
      }
      btnRow.addView(save)
    }

    card.addView(header)
    card.addView(
      badge,
      LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.WRAP_CONTENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
      ).apply {
        topMargin = dp(6)
      }
    )
    card.addView(
      preview,
      LinearLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT
      ).apply {
        topMargin = dp(12)
      }
    )
    card.addView(helper)
    card.addView(btnRow)

    root.addView(
      card,
      FrameLayout.LayoutParams(
        ViewGroup.LayoutParams.MATCH_PARENT,
        ViewGroup.LayoutParams.WRAP_CONTENT,
        Gravity.CENTER
      ).apply {
        setMargins(dp(22), 0, dp(22), 0)
      }
    )

    return root
  }

  private fun removeAll() {
    hideBubble()
    closeInput()
  }

  // ---- 工具 ----

  private fun overlayType(): Int {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
    } else {
      @Suppress("DEPRECATION")
      WindowManager.LayoutParams.TYPE_PHONE
    }
  }

  private fun dp(value: Int): Int =
    (value * context.resources.displayMetrics.density).toInt()

  private fun screenWidth(): Int = context.resources.displayMetrics.widthPixels
  private fun screenHeight(): Int = context.resources.displayMetrics.heightPixels

  private fun clampX(x: Int): Int =
    x.coerceIn(0, (screenWidth() - dp(BUBBLE_SIZE_DP + BUBBLE_MARGIN_DP * 2)).coerceAtLeast(0))

  private fun clampY(y: Int): Int =
    y.coerceIn(0, (screenHeight() - dp(BUBBLE_SIZE_DP + BUBBLE_MARGIN_DP * 2)).coerceAtLeast(0))
}
