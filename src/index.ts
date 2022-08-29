import { init } from './init';
import { findOpts } from './lib/findOpts';
import log from './lib/logger';
import { IMessageEx } from './lib/IMessageEx';
import fs from "fs";


var checkTimes = 0;

init().then(() => {

    global.ws.on('GUILD_MESSAGES', (data: IntentMessage) => {
        const msg = new IMessageEx(data.msg, "GUILD");// = data.msg as any;
        global.redis.set("lastestMsgId", msg.id, { EX: 5 * 60 });

        if (data.eventType == "MESSAGE_CREATE") {
            const opts = msg.content.trim().split(" ");
            /* findOpts(opts[0]).then(opt => {
                switch (opt) {
                    case "ping":
                        global.redis.ping().then(m => {
                            msg.sendMsgEx({ content: m });

                        }).catch(err => {
                            log.error(err);
                        });
                        break;
                    case "gacha":
                        gacha(msg);
                        break;
                    case "onceDaily":
                        onceCheck(msg);
                        break;
                    case "changeDaily":
                        break;
                    case "helpDaily":
                        break;
                    case "modeDaily":
                        break;
                    default:
                        break;
                }

            }); */

        }
    });

    global.ws.on("DIRECT_MESSAGE", async (data: IntentMessage) => {
        const msg = new IMessageEx(data.msg, "DIRECT");// = data.msg as any;

        global.redis.set("lastestMsgId", msg.id, { EX: 5 * 60 });
        global.redis.hSet(`genshin:config:${msg.author.id}`, "guildId", msg.guild_id);
        const opts = msg.content.trim().split(" ");
        //findOpts(msg.content).then(opt => {
        const opt = await findOpts(opts[0]);
        log.debug(`./plugins/${opt.path}:${opt.fnc}`);

        try {
            if (opt.path != "err") {
                const plugin = await import(`./plugins/${opt.path}.ts`);
                if (typeof plugin[opt.fnc] == "function") {
                    plugin[opt.fnc](msg);
                } else {
                    log.error(`not found function ${opt.fnc}() at "${global._path}/src/plugins/${opt.path}.ts"`);
                }
            }
        } catch (err) {
            log.error(err);
        }

    });

});


