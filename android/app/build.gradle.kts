import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "org.ailatest.journal"
    compileSdk = 36

    // Play uploads use a local upload key supplied through the environment.
    // Keeping the credentials out of source control also makes local builds
    // fall back safely to an unsigned release artifact when the key is absent.
    val uploadStoreFilePath = System.getenv("AILATEST_UPLOAD_STORE_FILE")
    val uploadStorePassword = System.getenv("AILATEST_UPLOAD_STORE_PASSWORD")
    val uploadKeyAlias = System.getenv("AILATEST_UPLOAD_KEY_ALIAS")
    val uploadKeyPassword = System.getenv("AILATEST_UPLOAD_KEY_PASSWORD")
    val hasUploadSigning = listOf(
        uploadStoreFilePath,
        uploadStorePassword,
        uploadKeyAlias,
        uploadKeyPassword,
    ).all { !it.isNullOrBlank() }

    if (hasUploadSigning) {
        signingConfigs {
            create("playUpload") {
                storeFile = file(uploadStoreFilePath!!)
                storePassword = uploadStorePassword
                keyAlias = uploadKeyAlias
                keyPassword = uploadKeyPassword
            }
        }
    }

    defaultConfig {
        applicationId = "org.ailatest.journal"
        minSdk = 26
        targetSdk = 36
        versionCode = 7
        versionName = "0.1.6"

        buildConfigField("String", "API_BASE_URL", "\"https://api.ailatest.org\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
            if (hasUploadSigning) {
                signingConfig = signingConfigs.getByName("playUpload")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

dependencies {
    // Stable Compose BOM compatible with the current AGP 8.7 / compileSdk 36 toolchain.
    val composeBom = platform("androidx.compose:compose-bom:2026.04.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.activity:activity-compose:1.10.0")
    implementation("androidx.core:core-ktx:1.16.0")
    // Billing pulls an obsolete Fragment transitively; pin the current stable line.
    implementation("androidx.fragment:fragment:1.9.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    debugImplementation("androidx.compose.ui:ui-tooling")

    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Current Play Billing API; purchase verification is still performed by our backend.
    implementation("com.android.billingclient:billing-ktx:9.1.0")
}
