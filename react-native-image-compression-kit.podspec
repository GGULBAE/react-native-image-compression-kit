require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name = "react-native-image-compression-kit"
  s.version = package["version"]
  s.summary = package["description"]
  s.license = package["license"]
  s.homepage = "https://github.com/GGULBAE/react-native-image-compression-kit"
  s.authors = "react-native-image-compression-kit contributors"
  s.source = { :git => "https://github.com/GGULBAE/react-native-image-compression-kit.git", :tag => "#{s.version}" }
  s.platforms = { :ios => "13.4" }
  s.source_files = "ios/**/*.{h,m,mm}"

  if respond_to?(:install_modules_dependencies, true)
    install_modules_dependencies(s)
  else
    s.dependency "React-Core"
  end
end
