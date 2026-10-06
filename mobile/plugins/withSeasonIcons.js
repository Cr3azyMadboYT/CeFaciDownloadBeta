// The app's icon by season (decision Cornel, 06.10). Android shows the icon of the launcher entry, so each look has
// its own entry: an activity-alias <package>.Icon_<look> that opens MainActivity, with its own adaptive icon (Bilu in
// front, the season behind). MainActivity loses its own launcher entry; exactly one alias is enabled, "vara" at
// install, and the module modules/cefaci-icon switches them (src/lib/season.ts). The pictures are made by
// scripts/season-icons.mjs into assets/icons/.
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod } = require('expo/config-plugins');

const LOOKS = ['primavara', 'vara', 'toamna', 'iarna', 'craciun'];
const FIRST = 'vara';

function withAliases(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    const main = app.activity.find((a) => a.$['android:name'] === '.MainActivity');
    if (!main) throw new Error('withSeasonIcons: no MainActivity in the manifest');
    const isLauncher = (f) => (f.action ?? []).some((x) => x.$['android:name'] === 'android.intent.action.MAIN')
      && (f.category ?? []).some((x) => x.$['android:name'] === 'android.intent.category.LAUNCHER');
    main['intent-filter'] = (main['intent-filter'] ?? []).filter((f) => !isLauncher(f));
    app['activity-alias'] = (app['activity-alias'] ?? []).filter((a) => !String(a.$['android:name']).startsWith('.Icon_'));
    for (const look of LOOKS) {
      app['activity-alias'].push({
        $: {
          'android:name': '.Icon_' + look,
          'android:targetActivity': '.MainActivity',
          'android:enabled': look === FIRST ? 'true' : 'false',
          'android:exported': 'true',
          'android:icon': '@mipmap/ic_launcher_' + look,
          'android:roundIcon': '@mipmap/ic_launcher_' + look,
          'android:label': '@string/app_name',
        },
        'intent-filter': [{
          action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
          category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
        }],
      });
    }
    return cfg;
  });
}

function withPictures(config) {
  return withDangerousMod(config, ['android', (cfg) => {
    const src = path.join(cfg.modRequest.projectRoot, 'assets', 'icons');
    const res = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'res');
    const dir = (d) => { const p = path.join(res, d); fs.mkdirSync(p, { recursive: true }); return p; };
    for (const look of LOOKS) {
      for (const [from, to] of [[look + '-fg.png', 'ic_season_' + look + '_fg.png'], [look + '-bg.png', 'ic_season_' + look + '_bg.png']]) {
        const f = path.join(src, from);
        if (!fs.existsSync(f)) throw new Error('withSeasonIcons: missing ' + f + ' (run scripts/season-icons.mjs)');
        fs.copyFileSync(f, path.join(dir('drawable-nodpi'), to));
      }
      // before Android 8: the flat icon
      fs.copyFileSync(path.join(src, look + '-legacy.png'), path.join(dir('mipmap-xxxhdpi'), 'ic_launcher_' + look + '.png'));
      fs.writeFileSync(path.join(dir('mipmap-anydpi-v26'), 'ic_launcher_' + look + '.xml'),
        '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        + '  <background android:drawable="@drawable/ic_season_' + look + '_bg"/>\n'
        + '  <foreground android:drawable="@drawable/ic_season_' + look + '_fg"/>\n</adaptive-icon>\n');
    }
    return cfg;
  }]);
}

module.exports = function withSeasonIcons(config) {
  return withPictures(withAliases(config));
};
