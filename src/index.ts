import { init } from './init';
import { findOpts } from './lib/findOpts';
import { IMessageEx } from './lib/IMessageEx';

init().then(() => {

    global.ws.on('GUILD_MESSAGES', async (data: IntentMessage) => {
        if (data.eventType != "MESSAGE_CREATE") return;
        const msg = new IMessageEx(data.msg, "GUILD");
        execute(msg);

    });

    global.ws.on("DIRECT_MESSAGE", async (data: IntentMessage) => {
        if (data.eventType != 'DIRECT_MESSAGE_CREATE') return;
        const msg = new IMessageEx(data.msg, "DIRECT");
        global.redis.hSet(`genshin:config:${msg.author.id}`, "guildId", msg.guild_id);
        execute(msg);
    });

});

async function execute(msg: IMessageEx) {
    global.redis.set("lastestMsgId", msg.id, { EX: 4 * 60 });
    msg.content = msg.content.trim().replace(/^\//, "#");
    const opt = await findOpts(msg);
    if (opt.path != "err") {
        log.debug(`./plugins/${opt.path}:${opt.fnc}`);
        const plugin = await import(`./plugins/${opt.path}.ts`);
        if (typeof plugin[opt.fnc] == "function") {
            return (plugin[opt.fnc] as PluginFnc)(msg).catch(err => {
                log.error(err);
            });
        } else log.error(`not found function ${opt.fnc}() at "${global._path}/src/plugins/${opt.path}.ts"`);
    }
}

type PluginFnc = (msg: IMessageEx) => Promise<any>
