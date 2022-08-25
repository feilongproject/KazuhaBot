import { createOpenAPI, createWebsocket, OpenAPI } from 'qq-guild-bot';
import { createClient } from 'redis';
import schedule from "node-schedule";
import log from './plugins/system/logger';
import config from '../data/config.json';
import { pushDaily } from './plugins/components/dailyManager';

export async function init() {

    var saveGuildsTree: SaveGuild[] = [];

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

    /* return client.meApi.me().then(res => {
        var meId = res.data.id;

        return client.meApi.meGuilds().then(guilds => {

            guilds.data.forEach(guild => {
                log.info(`${guild.name}(${guild.id})`);
                var _guild: SaveChannel[] = [];
                //log.info(guild.id);
                //log.info(guild.channels);
                client.channelApi.channels(guild.id).then(channels => {
                    channels.data.forEach((channel => {
                        if (channel.name != "") {
                            log.info(`${guild.name}(${guild.id})-${channel.name}(${channel.id})-father:${channel.parent_id}`);
                        }
                        _guild.push({ name: channel.name, id: channel.id });
                    }));

                    saveGuildsTree.push({ name: guild.name, id: guild.id, channel: _guild });
                }).catch(err => {
                    log.error(err);
                });



            });
            return { client, ws, saveGuildsTree, meId, databasePusher };
        });
    }); */

}