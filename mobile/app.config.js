// app.json plus what depends on the build: Firebase (notifications from friends) is turned on only when the build
// has google-services.json (GitHub writes it from the secret GOOGLE_SERVICES_JSON; it is never in git).
const fs = require('fs');
const path = require('path');

module.exports = ({ config }) => {
  const file = path.join(__dirname, 'google-services.json');
  if (fs.existsSync(file)) config.android = { ...config.android, googleServicesFile: './google-services.json' };
  return config;
};
