plugins {
    id("com.android.application") version "8.5.2" apply false
    id("org.jetbrains.kotlin.android") version "2.0.20" apply false
    // google-services.json이 준비되면 app 모듈에서 조건부로 적용됨 (app/build.gradle.kts 참고)
    id("com.google.gms.google-services") version "4.4.2" apply false
}
