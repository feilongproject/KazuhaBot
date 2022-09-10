import { createOpenAPI, createWebsocket, OpenAPI } from 'qq-guild-bot';
import { createClient } from 'redis';
import schedule from "node-schedule";
import fs from 'fs';
import log from './lib/logger';
import config from '../config/config.json';
import { taskPushDaily } from './plugins/dailyManager';
import { taskPushNews } from './plugins/announcementManager';

export async function init() {
    log.info(`机器人准备运行，正在初始化`);
    global._path = process.cwd();
    global.botStatus = {
        startTime: new Date(),
        msgSendNum: 0,
        imageRenderNum: 0,
    }

    log.info(`初始化：正在创建定时任务`);
    //体力推送
    schedule.scheduleJob("0 0/1 * * * ? ", () => taskPushDaily());
    ////自动签到
    //schedule.scheduleJob(BotConfig.pushTask.signTime, () => YunzaiApps.dailyNote.signTask());
    ////官方公告推送
    schedule.scheduleJob("0 0/30 * * * ? ", () => taskPushNews());
    ////原石统计推送
    //schedule.scheduleJob("0 0 10 L * ? ", () => YunzaiApps.dailyNote.ledgerTask());

    log.info(`初始化：正在检索图鉴资源`);
    const xyResPath = `${global._path}/resources/_xy`;
    global.xyResources = { length: "0" };
    if (fs.existsSync("xyResPath")) {
        traverseDir(xyResPath);
    } else {
        log.warn(`初始化：图鉴资源未找到，跳过检索`);
    }
    function traverseDir(fileDir: string) {
        try {
            const files = fs.readdirSync(fileDir, { withFileTypes: true });
            for (const unknownFile of files) {
                //if (unknownFile == ".git") continue;
                if (unknownFile.name == ".git") continue;
                //if (unknownFile.endsWith(".png")) {
                else if (unknownFile.name.endsWith(".png")) {
                    global.xyResources[unknownFile.name.replace(".png", "")] = `${fileDir}/${unknownFile.name}`;
                    global.xyResources.length = (parseInt(global.xyResources.length) + 1).toString();
                    continue;
                }
                try {
                    if (unknownFile.isDirectory()) traverseDir(`${fileDir}/${unknownFile.name}`);
                } catch (err) {
                    log.error('获取文件stats失败', err);
                }
            }
            log.mark(`通过 ${fileDir} 文件夹，总计加载了${global.xyResources.length}个图鉴资源图片`);
        } catch (err) {
            if (err) {
                console.warn("读取文件夹错误！", err);
                return;
            }
        }
    }

    log.info(`初始化：正在创建热加载监听`);
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

    log.info(`初始化：正在连接数据库`);
    global.redis = createClient({
        socket: { host: "127.0.0.1", port: 6379, },
        database: 0,
    });
    await global.redis.connect().then(() => {
        log.info(`初始化：redis数据库连接成功`);
    }).catch(err => {
        log.error(`初始化：redis数据库连接失败，正在退出程序\n${err}`);
        process.exit();
    });

    log.info(`初始化：正在创建client与ws`);
    global.client = createOpenAPI(config.initConfig);
    global.ws = createWebsocket(config.initConfig as any);

    log.info(`初始化：正在创建频道树`);
    global.saveGuildsTree = [];
    for (const guild of (await global.client.meApi.meGuilds()).data) {
        log.mark(`${guild.name}(${guild.id})`);
        var _guild: SaveChannel[] = [];
        for (const channel of (await global.client.channelApi.channels(guild.id)).data) {
            if (channel.name != "") {
                log.mark(`${guild.name}(${guild.id})-${channel.name}(${channel.id})-father:${channel.parent_id}`);
            }
            _guild.push({ name: channel.name, id: channel.id });
        }
        global.saveGuildsTree.push({ name: guild.name, id: guild.id, channel: _guild });
    }
}