const path=require('path');
const {getDefaultConfig}=require('expo/metro-config');
const config=getDefaultConfig(__dirname);
config.watchFolders=[path.resolve(__dirname,'../shared'),path.resolve(__dirname,'../src/app')];
config.resolver.nodeModulesPaths=[path.resolve(__dirname,'node_modules')];

// Shared UI must use this app's React, while packages retain their own nested dependencies.
config.resolver.resolveRequest=(context,name,platform)=>context.resolveRequest(
 /^(react|react-dom)(\/|$)/.test(name)?{...context,originModulePath:path.join(__dirname,'index.js')}:context,name,platform);
module.exports=config;
