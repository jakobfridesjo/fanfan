package io.github.jakobfridesjo.fanfan

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.enableEdgeToEdge
import java.lang.ref.WeakReference

class MainActivity : TauriActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)
    current = WeakReference(this)
  }

  companion object {
    private var current = WeakReference<MainActivity>(null)

    /** Called from Rust (`screen_awake.rs`) while a book is open. */
    @JvmStatic
    fun keepScreenOn(on: Boolean) {
      val activity = current.get() ?: return
      activity.runOnUiThread {
        if (on) {
          activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        } else {
          activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
      }
    }
  }
}
