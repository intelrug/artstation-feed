pm2 stop ecosystem.config.js

find . -maxdepth 1 ! -name node_modules ! -name artifacts ! -name .env.local ! -name .env.production.local ! -name . ! -name .. -exec rm -rf {} \;
mv artifacts/* .
mv artifacts/.[^.]* .
rm -r artifacts

nvm exec 14.18.1 npm i -g yarn
nvm exec 14.18.1 yarn --frozen-lockfile --production
nvm exec 14.18.1 yarn typeorm:prod migration:run
pm2 start ecosystem.config.js
