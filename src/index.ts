import { init, loadGuildTree } from './init';
import { findOpts } from './lib/findOpts';
import { IMessageGUILD, IMessageDIRECT } from './lib/IMessageEx';

init().then(() => {

    global.ws.on('GUILD_MESSAGES', async (data: IntentMessage.GUILD_MESSAGE) => {
        if (data.eventType != "MESSAGE_CREATE") return;
        if (global.devEnv && !adminId.includes(data.msg.author.id)) return;
        const msg = new IMessageGUILD(data.msg);
        execute(msg);

    });

    global.ws.on("DIRECT_MESSAGE", async (data: IntentMessage.DIRECT_MESSAGE) => {
        if (data.eventType != 'DIRECT_MESSAGE_CREATE') return;
        const msg = new IMessageDIRECT(data.msg);
        global.redis.hSet(`genshin:config:${msg.author.id}`, "guildId", msg.guild_id);
        execute(msg);
    });

    global.ws.on("GUILDS", (data) => {
        log.mark(`重新加载频道树中`);
        loadGuildTree().then(() => {
            log.mark(`频道树加载完毕`);
        }).catch(err => {
            log.error(`频道树加载失败`, err);
        });
    });
});

async function execute(msg: IMessageDIRECT | IMessageGUILD) {
    try {
        global.redis.set("lastestMsgId", msg.id, { EX: 4 * 60 });
        msg.content = msg.content.trim().replace(/^\//, "#");
        const opt = await findOpts(msg);
        if (!opt) return;
        if (devEnv) log.debug(`./plugins/${opt.path}:${opt.fnc}`);
        const plugin = await import(`./plugins/${opt.path}.ts`);
        if (typeof plugin[opt.fnc] == "function") {
            return (plugin[opt.fnc] as PluginFnc)(msg).catch(err => {
                log.error(err);
            });
        } else log.error(`not found function ${opt.fnc}() at "${global._path}/src/plugins/${opt.path}.ts"`);
    } catch (err) {
        log.error(err);
    }

}

type PluginFnc = (msg: IMessageDIRECT | IMessageGUILD) => Promise<any>
