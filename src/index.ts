import { ArkObj, IMessage, OpenAPI } from 'qq-guild-bot';
import { init } from './init';
import { bingCookie, checkCookie, deleteCookie, queryCookie } from './plugins/components/cookieManager';
import { gacha } from './plugins/genshin/gacha';
import { changeDaily, helpDaily, onceCheck, selectTemplate } from './plugins/components/dailyManager';
import { findOpts } from './plugins/system/findOpts';
import log from './plugins/system/logger';
import { handbook } from './plugins/genshin/handbook';
import { ledgerCount, ledgerPart } from './plugins/genshin/ledger';
import { strategy } from './plugins/genshin/strategy';
import { roleCard1, roleCard2, roleCard3, roleCardLife, roleCardWeapon, talentList, todayQuery } from './plugins/genshin/roleCard';
import { newsContentBBS, newsListBBS } from './plugins/components/announcementManager';
import { IMessageEx } from './plugins/system/IMessageEx';
import { dashboardHandle } from './plugins/components/dashboardManager';


var checkTimes = 0;

init().then(() => {

    global.ws.on('GUILD_MESSAGES', (data: IntentMessage) => {
        const msg = new IMessageEx(data.msg, "GUILD");// = data.msg as any;
        global.redis.set("lastestMsgId", msg.id, { EX: 5 * 60 });

        if (data.eventType == "MESSAGE_CREATE") {
            const opts = msg.content.trim().split(" ");
            findOpts(opts[0]).then(opt => {
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

            });




        }
    });

    global.ws.on("DIRECT_MESSAGE", (data: IntentMessage) => {
        const msg = new IMessageEx(data.msg, "DIRECT");// = data.msg as any;

        global.redis.set("lastestMsgId", msg.id, { EX: 5 * 60 });
        global.redis.hSet(`genshin:config:${msg.author.id}`, "guildId", msg.guild_id);
        const opts = msg.content.trim().split(" ");
        //findOpts(msg.content).then(opt => {
        findOpts(opts[0]).then(opt => {
            log.info(`opt:${opt}`);
            switch (opt) {
                case "gacha":
                    gacha(msg).catch(err => {
                        log.error(err);
                    });
                    break;
                case "bingCookie":
                    bingCookie(msg);
                    break;
                case "queryCookie":
                    queryCookie(msg);
                    break;
                case "delCookie":
                    deleteCookie(msg);
                    break;
                case "onceDaily":
                    onceCheck(msg);
                    break;
                case "changeDaily":
                    changeDaily(msg);
                    break;
                case "templateDaily":
                    selectTemplate(msg);
                    break;
                case "helpDaily":
                    helpDaily(msg);
                    break;
                case "ledgerPart":
                    ledgerPart(msg);
                    break;
                case "ledgerCount":
                    ledgerCount(msg);
                    break;
                case "strategy":
                    strategy(msg);
                    break;
                /* case "handbook":
                    handbook(msg);
                    break; */
                case "roleCard1":
                    roleCard1(msg);
                    break;
                case "roleCard2":
                    roleCard2(msg);
                    break;
                case "roleCard3":
                    roleCard3(msg);
                    break;
                case "roleCardLife":
                    roleCardLife(msg);
                    break;
                case "roleCardWeapon":
                    roleCardWeapon(msg);
                    break;
                case "talentList":
                    talentList(msg);
                    break;
                case "newsContentBBS":
                    newsContentBBS(msg);
                    break;
                case "newsListBBS":
                    newsListBBS(msg);
                    break;
                case "todayQuery":
                    todayQuery(msg);
                    break;
                case "checkCookie":
                    checkCookie(msg);
                    break;
                case "dashboardHandle":
                    dashboardHandle(msg);
                    break;

                case "ping":
                    global.redis.ping().then(pong => {
                        msg.sendMsgEx({ content: pong });
                    }).catch(err => {
                        log.error(err);
                    });
                    break;
                case "err":
                    msg.sendMsgEx({ content: "未知的指令" });
                    break;
            }

        });
    });

});


