package expo.modules.smsinbox

import android.Manifest
import android.content.pm.PackageManager
import android.provider.BaseColumns
import android.provider.Telephony
import android.provider.Telephony.TextBasedSmsColumns
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reads SMS from businesses (bank alerts) out of the inbox.
 *
 * Privacy: messages from phone numbers (people) are filtered out here, in native code, so
 * their text never reaches the app. One-time passwords are dropped here too.
 */
class SmsInboxModule : Module() {
  // Sender IDs look like "AX-HDFCBK", "JD-SBIUPI-S" or plain "HDFCBK"; people are numbers.
  private val businessSender = Regex("^(?:[A-Z]{2}-)?[A-Z0-9]{3,9}(?:-[A-Z])?$", RegexOption.IGNORE_CASE)
  private val otp = Regex(
    "\b(?:otp|one[ -]?time[ -]?pass(?:word|code)?|verification code|security code)\b",
    RegexOption.IGNORE_CASE
  )

  override fun definition() = ModuleDefinition {
    Name("SmsInbox")

    Function("hasPermission") {
      val context = appContext.reactContext ?: return@Function false
      context.checkSelfPermission(Manifest.permission.READ_SMS) ==
        PackageManager.PERMISSION_GRANTED
    }

    // Newest first: messages received after `sinceMs` (epoch millis), at most `limit`.
    AsyncFunction("readSince") { sinceMs: Double, limit: Int ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      if (context.checkSelfPermission(Manifest.permission.READ_SMS) !=
        PackageManager.PERMISSION_GRANTED
      ) {
        throw CodedException("ERR_NO_PERMISSION", "SMS access hasn't been allowed", null)
      }
      val out = mutableListOf<Map<String, Any>>()
      val cursor = context.contentResolver.query(
        Telephony.Sms.Inbox.CONTENT_URI,
        arrayOf(BaseColumns._ID, TextBasedSmsColumns.ADDRESS, TextBasedSmsColumns.BODY, TextBasedSmsColumns.DATE),
        "${TextBasedSmsColumns.DATE} > ?",
        arrayOf(sinceMs.toLong().toString()),
        "${TextBasedSmsColumns.DATE} DESC"
      ) ?: return@AsyncFunction out
      cursor.use {
        val idCol = it.getColumnIndexOrThrow(BaseColumns._ID)
        val addressCol = it.getColumnIndexOrThrow(TextBasedSmsColumns.ADDRESS)
        val bodyCol = it.getColumnIndexOrThrow(TextBasedSmsColumns.BODY)
        val dateCol = it.getColumnIndexOrThrow(TextBasedSmsColumns.DATE)
        while (it.moveToNext() && out.size < limit) {
          val address = it.getString(addressCol)?.trim() ?: continue
          if (!businessSender.matches(address) || address.none { ch -> ch.isLetter() }) continue
          val body = it.getString(bodyCol) ?: continue
          if (otp.containsMatchIn(body)) continue
          out.add(
            mapOf(
              "id" to it.getLong(idCol).toString(),
              "address" to address.uppercase(),
              "body" to body,
              "date" to it.getLong(dateCol).toDouble()
            )
          )
        }
      }
      out
    }
  }
}
