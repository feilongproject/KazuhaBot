import { IMember } from "qq-guild-bot";
import { IMessageEx } from "../lib/IMessageEx";

export async function status(msg: IMessageEx) {
    return msg.sendMsgEx({
        content: `------状态------` +
            `\n运行时间：${timeConver(new Date().getTime() - global.botStatus.startTime.getTime())}` +
            `\n发送消息：${global.botStatus.msgSendNum}条` +
            `\n生成图片：${global.botStatus.imageRenderNum}次` +
            `\n内存使用：${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)}MB`
    });
}

export async function ping(msg: IMessageEx) {
    msg.sendMsgEx({ content: await global.redis.ping() });
}


export async function isAdmin(uid: string, iMember?: IMember, srcGuild?: string): Promise<boolean> {
    if (adminId.includes(uid)) return true;
    if (srcGuild) {
        iMember = await client.guildApi.guildMember(srcGuild, uid).then(d => {
            return d.data;
        }).catch(err => {
            log.error(err);
            return undefined;
        });
    }
    if (iMember && (iMember.roles.includes("2") || iMember.roles.includes("4")))
        return true;
    return await redis.hGet("auth", uid).then(auth => {
        if (auth == "admin") return true;
        return false;
    });
}

function timeConver(time: number) {
    time /= 1000;
    if (time < 60) {
        return "不足1分钟";
    }
    time /= 60;
    time = parseInt(time.toFixed(0));
    const m = time % 60;
    if (time < 60) return `${m}分钟`;
    time /= 60;
    time = parseInt(time.toFixed(0));
    return `${time}小时${m}分钟`;
}
