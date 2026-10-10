// UIKit alternate icons use opaque App Store catalogs; Android assets stay unchanged.
const fs = require('fs');
const path = require('path');
const {withDangerousMod, withInfoPlist, withXcodeProject} = require('expo/config-plugins');
const {generateImageAsync} = require('@expo/image-utils');
const ALTERNATES = ['primavara', 'toamna', 'iarna', 'craciun'];
module.exports = function withIosSeasonIcons(config) {
  config = withInfoPlist(config, cfg => {
    const icons = Object.fromEntries(ALTERNATES.map(look => ['Icon_'+look, {CFBundleIconName:'Icon_'+look, CFBundleIconFiles:['Icon_'+look], UIPrerenderedIcon:false}]));
    cfg.modResults.CFBundleIcons = {...cfg.modResults.CFBundleIcons, CFBundleAlternateIcons:icons};
    return cfg;
  });
  config = withDangerousMod(config, ['ios', async cfg => {
    const root = cfg.modRequest.projectRoot, native = cfg.modRequest.platformProjectRoot;
    const candidates = fs.readdirSync(native).filter(name => fs.existsSync(path.join(native, name, 'Images.xcassets')));
    if (candidates.length !== 1) throw new Error('Client seasonal icons: expected exactly one asset catalog');
    for (const look of ALTERNATES) {
      const folder = path.join(native, candidates[0], 'Images.xcassets', 'Icon_'+look+'.appiconset');
      fs.mkdirSync(folder, {recursive:true});
      const image = await generateImageAsync({projectRoot:root, cacheType:'client-season-icons-ios-opaque'}, {src:path.join(root,'assets/icons',look+'.png'), width:1024, height:1024, resizeMode:'cover', removeTransparency:true});
      fs.writeFileSync(path.join(folder, 'icon.png'), image.source);
      fs.writeFileSync(path.join(folder, 'Contents.json'), JSON.stringify({images:[{filename:'icon.png',idiom:'universal',platform:'ios',size:'1024x1024'}],info:{version:1,author:'expo'}}, null, 2));
    }
    return cfg;
  }]);
  return withXcodeProject(config, cfg => {
    for (const item of Object.values(cfg.modResults.pbxXCBuildConfigurationSection())) if (item?.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER) {
      item.buildSettings.ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES='"'+ALTERNATES.map(x=>'Icon_'+x).join(' ')+'"';
      item.buildSettings.ASSETCATALOG_COMPILER_INCLUDE_ALL_APPICON_ASSETS='YES';
    }
    return cfg;
  });
};
