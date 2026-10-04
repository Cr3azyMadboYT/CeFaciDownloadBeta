// app.json plus what depends on the build: Firebase (notifications from friends) is on when google-services.json is
// there. It is in git (decision Cornel, 04.10): it only names the Firebase project and its key works only for the
// app ro.cefaci.app; the secret GOOGLE_SERVICES_JSON, if set, replaces it in the build.
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const file = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(file)) config.android = { ...config.android, googleServicesFile: './google-services.json' };
  return config;
};
