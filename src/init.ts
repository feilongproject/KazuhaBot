import { createOpenAPI, createWebsocket, OpenAPI } from 'qq-guild-bot';
import { createClient } from 'redis';
import schedule from "node-schedule";
import fs from 'fs';
import log from './lib/logger';
import config from '../config/config.json';
import { pushDaily } from './plugins/dailyManager';

export async function init() {

    global._path = process.cwd();

    global.botStatus = {
        startTime: new Date(),
        msgSendNum: 0,
        imageRenderNum: 0,
    }

    global.client = createOpenAPI(config.initConfig);
    global.ws = createWebsocket(config.initConfig as any);

    global.redis = createClient({
        socket: {
            host: "127.0.0.1",
            port: 6379,
        },
        database: 0,
    });
    await global.redis.connect();

    //体力推送
    schedule.scheduleJob("0 0/1 * * * ? ", () => pushDaily());
    ////自动签到
    //schedule.scheduleJob(BotConfig.pushTask.signTime, () => YunzaiApps.dailyNote.signTask());
    ////官方公告推送
    //schedule.scheduleJob("0 3,33 * * * ? ", () => YunzaiApps.newsListBBS.pushNewsTask());
    ////原石统计推送
    //schedule.scheduleJob("0 0 10 L * ? ", () => YunzaiApps.dailyNote.ledgerTask());


    global.saveGuildsTree = [];
    client.meApi.meGuilds().then(guilds => {

        for (const guild of guilds.data) {
            log.info(`${guild.name}(${guild.id})`);
            var _guild: SaveChannel[] = [];
            global.client.channelApi.channels(guild.id).then(channels => {
                for (const channel of channels.data) {
                    if (channel.name != "") {
                        log.info(`${guild.name}(${guild.id})-${channel.name}(${channel.id})-father:${channel.parent_id}`);
                    }
                    _guild.push({ name: channel.name, id: channel.id });
                }
                global.saveGuildsTree.push({ name: guild.name, id: guild.id, channel: _guild });
            }).catch(err => {
                log.error(err);
            });
        }


    });

    fs.watch(`${global._path}/src/plugins/`, (event, filename) => {
        //log.debug(event, filename);
        if (event != "change") return;
        if (require.cache[`${global._path}/src/plugins/${filename}`]) {
            log.mark(`文件${global._path}/src/plugins/${filename}已修改，正在执行热更新`);
            delete require.cache[`${global._path}/src/plugins/${filename}`];
        }
    });

    const optFile = `${global._path}/config/opts.json`;
    fs.watchFile(optFile, () => {
        if (require.cache[optFile]) {
            log.mark(`指令配置文件正在进行热更新`);
            delete require.cache[optFile];
        }
    });


    const xyResPath = `${global._path}/resources/_xy`;
    global.xyResources = { length: "0" };
    traverseDir(xyResPath);
    function traverseDir(fileDir: string) {
        fs.readdir(fileDir, function (err, files) {
            if (err) { console.warn(err, "读取文件夹错误！"); return; }
            for (const unknownFile of files) {
                if (unknownFile == ".git") continue;
                if (unknownFile.endsWith(".png")) {
                    global.xyResources[unknownFile.replace(".png", "")] = `${fileDir}/${unknownFile}`;
                    global.xyResources.length = (parseInt(global.xyResources.length) + 1).toString();
                }
                else fs.stat(`${fileDir}/${unknownFile}`, function (eror, stats) {
                    if (eror) { console.warn('获取文件stats失败'); return; }
                    //console.log(`${fileDir}/${unknownFile}`);
                    else if (stats.isDirectory()) {
                        traverseDir(`${fileDir}/${unknownFile}`);
                    }

                });
            }
            log.info(`通过 ${fileDir} 文件夹，总计加载了${global.xyResources.length}个图鉴资源图片`);
        });
    }
}