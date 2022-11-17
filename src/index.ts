import { init } from './init';
import { findOpts } from './lib/findOpts';
import { IMessageEx } from './lib/IMessageEx';

init().then(() => {

    global.ws.on('GUILD_MESSAGES', async (data: IntentMessage) => {

        if (data.eventType == "MESSAGE_CREATE") {
            const msg = new IMessageEx(data.msg, "GUILD");// = data.msg as any;
            global.redis.set("lastestMsgId", msg.id, { EX: 5 * 60 });

            const opt = await findOpts(msg);
            log.debug(`./plugins/${opt.path}:${opt.fnc}`);
            try {
                if (opt.path != "err") {
                    const plugin = await import(`./plugins/${opt.path}.ts`);
                    if (typeof plugin[opt.fnc] == "function") {
                        (plugin[opt.fnc] as PluginFnc)(msg).catch(err => {
                            log.error(err);
                        });
                    } else {
                        log.error(`not found function ${opt.fnc}() at "${global._path}/src/plugins/${opt.path}.ts"`);
                    }
                }
            } catch (err) {
                log.error(err);
            }
        }
    });

    global.ws.on("DIRECT_MESSAGE", async (data: IntentMessage) => {
        if (data.eventType != 'DIRECT_MESSAGE_CREATE') return;
        const msg = new IMessageEx(data.msg, "DIRECT");// = data.msg as any;
        global.redis.set("lastestMsgId", msg.id, { EX: 5 * 60 });
        global.redis.hSet(`genshin:config:${msg.author.id}`, "guildId", msg.guild_id);

        const opt = await findOpts(msg);
        log.debug(`./plugins/${opt.path}:${opt.fnc}`);

        try {
            if (opt.path != "err") {
                const plugin = await import(`./plugins/${opt.path}.ts`);
                if (typeof plugin[opt.fnc] == "function") {
                    (plugin[opt.fnc] as PluginFnc)(msg).catch(err => {
                        log.error(err);
                    });
                } else {
                    log.error(`not found function ${opt.fnc}() at "${global._path}/src/plugins/${opt.path}.ts"`);
                }
            }
        } catch (err) {
            log.error(err);
        }

    });

});

type PluginFnc = (msg: IMessageEx) => Promise<any>
