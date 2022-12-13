// 因为pm2 不能直接启动ts 使用需要通过js启动程序
require('ts-node').register();
require('./src/index');