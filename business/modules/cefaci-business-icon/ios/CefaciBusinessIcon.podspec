Pod::Spec.new do |s|
  s.name = 'CefaciBusinessIcon'
  s.version = '0.1.0'
  s.summary = 'Seasonal CeFaci Business launcher icons'
  s.description = s.summary
  s.license = { :type => 'Proprietary' }
  s.author = 'CeFaci'
  s.homepage = 'https://cefaci.app'
  s.platforms = { :ios => '16.0' }
  s.source = { :git => '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.frameworks = 'UIKit'
  s.source_files = '**/*.{h,m,mm,swift}'
  s.swift_version = '5.9'
end
