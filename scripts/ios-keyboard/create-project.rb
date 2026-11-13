require 'fileutils'
require 'xcodeproj'

# Generate disposable build files outside the checkout. Requires the xcodeproj gem.
root = File.expand_path(ARGV.fetch(0, '/private/tmp/miniapp-ios-keyboard'))
FileUtils.mkdir_p(root)
%w[Host.swift KeyboardTests.swift fixture.js].each { |name| FileUtils.cp(File.join(__dir__, name), root) }
File.write(File.join(root, 'Info.plist'), <<~PLIST)
  <?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>$(PRODUCT_BUNDLE_IDENTIFIER)</string><key>CFBundleExecutable</key><string>$(EXECUTABLE_NAME)</string><key>CFBundleName</key><string>KeyboardHost</string><key>CFBundlePackageType</key><string>APPL</string><key>CFBundleVersion</key><string>1</string><key>CFBundleShortVersionString</key><string>1.0</string><key>LSRequiresIPhoneOS</key><true/><key>UILaunchScreen</key><dict/><key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/><key>NSAllowsArbitraryLoadsInWebContent</key><true/></dict><key>UISupportedInterfaceOrientations</key><array><string>UIInterfaceOrientationPortrait</string></array></dict></plist>
PLIST
project = Xcodeproj::Project.new(File.join(root, 'Keyboard.xcodeproj'))
app = project.new_target(:application, 'KeyboardHost', :ios, '18.0')
tests = project.new_target(:ui_test_bundle, 'KeyboardTests', :ios, '18.0')
app.source_build_phase.add_file_reference(project.main_group.new_file('Host.swift'))
app.resources_build_phase.add_file_reference(project.main_group.new_file('fixture.js'))
tests.source_build_phase.add_file_reference(project.main_group.new_file('KeyboardTests.swift'))
tests.add_dependency(app)
[app, tests].each do |target|
  target.build_configurations.each do |config|
    config.build_settings['SWIFT_VERSION'] = '5.0'
    config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = "com.example.miniapp.#{target.name}"
    config.build_settings['TARGETED_DEVICE_FAMILY'] = '1'
    config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
  end
end
app.build_configurations.each { |config| config.build_settings['INFOPLIST_FILE'] = 'Info.plist' }
tests.build_configurations.each do |config|
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['TEST_TARGET_NAME'] = 'KeyboardHost'
end
project.save
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(app)
scheme.add_build_target(tests)
scheme.add_test_target(tests)
scheme.set_launch_target(app)
scheme.save_as(File.join(root, 'Keyboard.xcodeproj'), 'KeyboardHost', true)
puts File.join(root, 'Keyboard.xcodeproj')
