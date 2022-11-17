import { isAdmin } from "../plugins/admin";
import { IMessageEx } from "./IMessageEx";

export async function findOpts(msg: IMessageEx): Promise<{ path: string; fnc: string; }> {
    if (!msg.content) return { path: "err", fnc: "err" };

    const fnc = await import("../../config/opts.json");
    const command: {
        [mainKey: string]: {
            [key: string]: {
                reg: string;
                fnc: string;
                type: string[];
                permission?: string;
                describe: string;
            }
        }
    } = fnc.command;

    for (const mainKey in command) {
        for (const key in command[mainKey]) {
            const opt = command[mainKey][key];
            if (!opt.type.includes(msg.messageType)) continue;
            if (!RegExp(opt.reg).test(msg.content)) continue;

            if (opt.permission != "anyone") {
                if (msg.messageType == "GUILD"
                    && !await isAdmin(msg.author.id, msg.member)
                ) continue;
                if (msg.messageType == "DIRECT"
                    && !await isAdmin(msg.author.id, undefined, msg.src_guild_id)
                ) continue;
            }
            return {
                path: mainKey,
                fnc: opt.fnc,
            };
        }
    }


    return {
        path: "err",
        fnc: "err",
    };
}