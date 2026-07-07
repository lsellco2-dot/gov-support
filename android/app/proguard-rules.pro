# JS 브릿지 메서드는 리플렉션으로 호출되므로 난독화 제외
-keepclassmembers class com.govsupport.app.WebAppBridge {
    @android.webkit.JavascriptInterface <methods>;
}
