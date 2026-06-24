package com.imagecompressionkit

import com.facebook.react.BaseReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.module.model.ReactModuleInfo
import com.facebook.react.module.model.ReactModuleInfoProvider

class ImageCompressionKitPackage : BaseReactPackage() {
  override fun getModule(
    name: String,
    reactContext: ReactApplicationContext
  ): NativeModule? =
    if (name == ImageCompressionKitModule.NAME) {
      ImageCompressionKitModule(reactContext)
    } else {
      null
    }

  override fun getReactModuleInfoProvider(): ReactModuleInfoProvider =
    ReactModuleInfoProvider {
      mapOf(
        ImageCompressionKitModule.NAME to ReactModuleInfo(
          ImageCompressionKitModule.NAME,
          ImageCompressionKitModule.NAME,
          false,
          false,
          false,
          true
        )
      )
    }
}
