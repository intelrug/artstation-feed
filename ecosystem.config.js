module.exports = {
  apps: [{
    name: 'ArtStation Feed',
    script: 'dist/main.js',
    interpreter: 'node@14.18.1',
    node_args: '--require=./environment.js',
    autorestart: true,
    env: {
      NODE_ENV: 'production',
    },
  }],
};
