module.exports = {
  dependency: {
    platforms: {
      android: {
        sourceDir: './android',
        packageImportPath:
          'import com.imagecompressionkit.ImageCompressionKitPackage;',
        packageInstance: 'new ImageCompressionKitPackage()',
      },
      ios: {
        podspecPath: './react-native-image-compression-kit.podspec',
      },
    },
  },
};
