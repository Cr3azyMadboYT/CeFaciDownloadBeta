// The phone app shares the search engine, the venues and the account code with the rest of the repo (../src).
// Only ../src is watched, so whatever those files import comes from this folder's node_modules.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const root = path.resolve(__dirname, '..');
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.join(root, 'src'), path.join(root, 'shared')];
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules')];

// Shared UI must use this app's React, while packages retain their own nested dependencies.
config.resolver.resolveRequest=(context,name,platform)=>context.resolveRequest(
 /^(react|react-dom)(\/|$)/.test(name)?{...context,originModulePath:path.join(__dirname,'index.js')}:context,name,platform);
module.exports = config;
