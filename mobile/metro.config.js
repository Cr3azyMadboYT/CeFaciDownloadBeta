// The phone app shares the search engine, the venues and the account code with the rest of the repo (../src).
// Only ../src is watched, so whatever those files import comes from this folder's node_modules.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const root = path.resolve(__dirname, '..');
const config = getDefaultConfig(__dirname);
config.watchFolders = [path.join(root, 'src'), path.join(root, 'shared')];
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;
module.exports = config;
