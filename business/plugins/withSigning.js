// Signs release builds with the CeFaci key when its four Gradle properties are present
// (CEFACI_KEYSTORE, CEFACI_KEYSTORE_PASSWORD, CEFACI_KEY_ALIAS, CEFACI_KEY_PASSWORD, set by the GitHub workflow
// from repository secrets, or in ~/.gradle/gradle.properties). Without them, release falls back to the debug key.
const { withAppBuildGradle } = require('expo/config-plugins');

const BLOCK = `
        release {
            if (project.hasProperty('CEFACI_KEYSTORE')) {
                storeFile file(CEFACI_KEYSTORE)
                storePassword CEFACI_KEYSTORE_PASSWORD
                keyAlias CEFACI_KEY_ALIAS
                keyPassword CEFACI_KEY_PASSWORD
            }
        }`;

module.exports = function withSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (g.includes('CEFACI_KEYSTORE')) return cfg;
    g = g.replace(/signingConfigs\s*\{/, (m) => m + BLOCK);
    g = g.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
      "$1signingConfig project.hasProperty('CEFACI_KEYSTORE') ? signingConfigs.release : signingConfigs.debug");
    if (!g.includes("signingConfigs.release : signingConfigs.debug")) throw new Error('withSigning: build.gradle changed shape; update the plugin');
    cfg.modResults.contents = g;
    return cfg;
  });
};
