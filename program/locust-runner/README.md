# درع الجراد – المشغّل اليومي

يشغّل هذا المجلد نموذج «درع الجراد» نفسه المستخدم في صفحة البرنامج، ولكن من سطر الأوامر وببيانات حية:

1. رياح 16 يوماً من ثلاثة نماذج (ECMWF وGFS وICON).
2. أمطار آخر 60 يوماً في مناطق التكاثر.
3. التنبؤ الموسمي ECMWF SEAS5.

ثم يكتب تقريراً ويرسل تنبيهاً عند الحاجة.

## المتطلبات
- Node.js 18 أو أحدث (https://nodejs.org)
- اتصال بالإنترنت.

## التشغيل
```
node daily-run.mjs
node daily-run.mjs --test     # يرسل تنبيهاً تجريبياً مهما كان المستوى
```
يُكتب التقرير في `reports/latest.txt`، ويُحفظ تقرير مفصل بصيغة JSON لكل تشغيل.

## الإعدادات: انسخ `alert-config.example.json` إلى `alert-config.json` وعدّله
| الحقل | المعنى |
|---|---|
| `faoLevel` | مستوى الفاو الحالي للمنطقة الوسطى: `calm` أو `caution` أو `threat` أو `danger`. حدّثه عند صدور نشرة جديدة. |
| `minLevel` | أدنى مستوى يُرسل عنده تنبيه: 0 أخضر، 1 أصفر، 2 برتقالي، 3 أحمر. |
| `notifyOnChange` | إرسال تنبيه عند أي تغيّر في المستوى. |
| `webhookUrl` | رابط Webhook لـ Microsoft Teams أو Slack أو Google Chat. يُرسل `{"text": "..."}`. |
| `telegram` | رمز بوت تيليجرام ومعرّف المحادثة. |
| `reportsCsv` | مسار ملف CSV للبلاغات المؤكدة (تصدير Locust Hub أو بلاغات وقاء). |

## الجدولة اليومية على ويندوز
من داخل هذا المجلد:
```
schtasks /Create /SC DAILY /ST 06:00 /TN "LocustShield" /TR "%CD%\run-daily.bat"
```
للإلغاء: `schtasks /Delete /TN "LocustShield" /F`

## تحديث بيانات الأساس
الملف `base-data.js` يحتوي الحدود الجغرافية وصورة الخضرة من الأقمار الصناعية (MODIS NDVI) ولقطة احتياطية. ويمكن استبداله بالنسخة الأحدث من صفحة البرنامج عند الحاجة.

---
**English:** `node daily-run.mjs` runs the Locust Shield model on live data, writes `reports/latest.txt`, and posts an alert to a webhook or Telegram when the level reaches `minLevel` or changes. Copy `alert-config.example.json` to `alert-config.json` to configure it. Schedule it with the `schtasks` command above.
