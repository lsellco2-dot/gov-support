plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// google-services.json이 있을 때만 Firebase 플러그인 적용 → 파일이 없어도 빌드가 깨지지 않음.
// 파일 위치와 발급 절차는 android/README.md 참고.
if (file("google-services.json").exists()) {
    apply(plugin = "com.google.gms.google-services")
} else {
    logger.warn("⚠ google-services.json 없음 — FCM 비활성 상태로 빌드합니다 (android/README.md 참고)")
}

android {
    namespace = "com.govsupport.app"
    compileSdk = 35

    defaultConfig {
        // TODO: Play 배포 전 실제 소유 도메인 기반 패키지명으로 변경 (변경 시 Firebase 앱 등록도 다시)
        applicationId = "com.govsupport.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        debug {
            // 에뮬레이터에서 호스트 PC의 next dev 서버 (10.0.2.2 = 호스트 localhost)
            buildConfigField("String", "BASE_URL", "\"http://10.0.2.2:3000/app\"")
        }
        release {
            // TODO: 실서비스 도메인으로 교체
            buildConfigField("String", "BASE_URL", "\"https://REPLACE-WITH-PRODUCTION-DOMAIN.com/app\"")
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            // TODO: 서명 설정 (signingConfig) 추가 후 배포
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("androidx.webkit:webkit:1.11.0")
    // 외부 링크(detail_url)를 여는 Chrome Custom Tab
    implementation("androidx.browser:browser:1.8.0")

    // FCM — google-services.json이 없으면 런타임에 비활성 (코드에서 FirebaseApp 초기화 여부 확인)
    implementation(platform("com.google.firebase:firebase-bom:33.3.0"))
    implementation("com.google.firebase:firebase-messaging")
}
