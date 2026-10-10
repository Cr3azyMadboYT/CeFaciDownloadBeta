const fs = require('fs');
const path = require('path');
const {withAndroidManifest, withDangerousMod, withInfoPlist, withXcodeProject} = require('expo/config-plugins');
const {generateImageAsync} = require('@expo/image-utils');
const LOOKS = ['primavara', 'vara', 'toamna', 'iarna', 'craciun'];
const FIRST = 'toamna';
const ALTERNATES = LOOKS.filter(look => look !== FIRST);
const INSET = 27; // Every foreground's alpha silhouette fits Android's 66/108 safe circle.
function applyAliases(manifest) {
  const app = manifest.application[0];
  const main = app.activity.find(a => a.$['android:name'] === '.MainActivity');
  if (!main) throw new Error('Business seasonal icons: MainActivity missing');
  const launcher = f => (f.action || []).some(x => x.$['android:name'] === 'android.intent.action.MAIN') && (f.category || []).some(x => x.$['android:name'] === 'android.intent.category.LAUNCHER');
  main['intent-filter'] = (main['intent-filter'] || []).filter(f => !launcher(f));
  app['activity-alias'] = (app['activity-alias'] || []).filter(a => !String(a.$['android:name']).startsWith('.Icon_'));
  for (const look of LOOKS) app['activity-alias'].push({
    $: {'android:name': '.Icon_'+look, 'android:targetActivity': '.MainActivity', 'android:enabled': String(look === FIRST), 'android:exported': 'true', 'android:icon': '@mipmap/ic_launcher_'+look, 'android:roundIcon': '@mipmap/ic_launcher_'+look, 'android:label': '@string/app_name'},
    'intent-filter': [{action: [{$: {'android:name': 'android.intent.action.MAIN'}}], category: [{$: {'android:name': 'android.intent.category.LAUNCHER'}}]}],
  });
  return manifest;
}
async function resized(root, src, size, removeTransparency = false) {
  return (await generateImageAsync({projectRoot: root, cacheType: removeTransparency ? 'business-season-icons-ios-opaque' : 'business-season-icons'}, {src, width: size, height: size, resizeMode: 'cover', removeTransparency})).source;
}
module.exports = function withSeasonIcons(config) {
  config = withAndroidManifest(config, cfg => {cfg.modResults.manifest = applyAliases(cfg.modResults.manifest); return cfg;});
  config = withDangerousMod(config, ['android', async cfg => {
    const root = cfg.modRequest.projectRoot, src = path.join(root, 'assets/icons');
    const res = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res');
    const dir = name => {const d = path.join(res,name); fs.mkdirSync(d,{recursive:true}); return d;};
    for (const look of LOOKS) {
      for (const layer of ['bg','fg']) fs.copyFileSync(path.join(src,look+'-'+layer+'.png'),path.join(dir('drawable-nodpi'),'ic_season_'+look+'_'+layer+'.png'));
      fs.writeFileSync(path.join(dir('mipmap-xxxhdpi'),'ic_launcher_'+look+'.png'),await resized(root,path.join(src,look+'.png'),192));
      fs.writeFileSync(path.join(dir('mipmap-anydpi-v26'),'ic_launcher_'+look+'.xml'),`<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@drawable/ic_season_${look}_bg"/><foreground><inset android:drawable="@drawable/ic_season_${look}_fg" android:inset="${INSET}%"/></foreground></adaptive-icon>\n`);
    }
    return cfg;
  }]);
  config = withInfoPlist(config, cfg => {
    const alternate = Object.fromEntries(ALTERNATES.map(look => ['Icon_'+look, {CFBundleIconName:'Icon_'+look, CFBundleIconFiles:['Icon_'+look], UIPrerenderedIcon:false}]));
    for (const key of ['CFBundleIcons','CFBundleIcons~ipad']) cfg.modResults[key] = {...cfg.modResults[key], CFBundleAlternateIcons:alternate};
    return cfg;
  });
  config = withDangerousMod(config,['ios',async cfg => {
    const root=cfg.modRequest.projectRoot;
    const native=cfg.modRequest.platformProjectRoot;
    const candidates = fs.readdirSync(native).filter(name => fs.existsSync(path.join(native,name,'Images.xcassets')));
    if (candidates.length !== 1) throw new Error('Business seasonal icons: expected exactly one asset catalog');
    for(const look of ALTERNATES) {
      const catalog=path.join(native,candidates[0],'Images.xcassets','Icon_'+look+'.appiconset');fs.mkdirSync(catalog,{recursive:true});
      fs.writeFileSync(path.join(catalog,'icon.png'),await resized(root,path.join(root,'assets/icons',look+'.png'),1024,true));
      fs.writeFileSync(path.join(catalog,'Contents.json'),JSON.stringify({images:[{filename:'icon.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{version:1,author:'expo'}},null,2));
    }
    return cfg;
  }]);
  config = withXcodeProject(config,cfg => {
    const configurations=cfg.modResults.pbxXCBuildConfigurationSection();
    for(const entry of Object.values(configurations)) if(entry && entry.buildSettings && entry.buildSettings.PRODUCT_BUNDLE_IDENTIFIER) {
      entry.buildSettings.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES='"'+ALTERNATES.map(x=>'Icon_'+x).join(' ')+'"';
      entry.buildSettings.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS='YES';
    }
    return cfg;
  });
  return config;
};
module.exports.applyAliases = applyAliases;
module.exports.LOOKS = LOOKS;
module.exports.INSET = INSET;
