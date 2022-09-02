import fs from "fs";
import { exec } from "child_process";
import log from "../lib/logger";
import { IMessageEx } from "../lib/IMessageEx";
import { roleToRole } from "./roleConver";
import helpInfo from "../../data/help.json";
import { render } from "../lib/render";

const typeList = ["weapons", "foods", "enemys", "uncharteds", "artifacts", "items"];

export async function handbook(msg: IMessageEx) {

    if ((await global.redis.hGet(`config:handbook`, "dirOpen")) == "1") {
        const aliasMap: { [key: string]: string[] } = (await import("../../data/xy/map.json")).default;

        for (const key in aliasMap) {
            const mapReg = new RegExp(`#(${key})`);
            if (mapReg.test(msg.content)) {
                msg.sendMsgEx({ content: `请选择：\n${aliasMap[key].join("\n")}` });
                return true;
            }
        }
    }

    const findReg = /^#(.{1,})图鉴$/.exec(msg.content);
    if (!findReg) return false;

    const regEnd: {
        type: string | null;
        name: string;
    } = { type: null, name: "" };

    const roleName = roleToRole(findReg[1]);
    if (roleName == "旅行者") {
        if (["风主", "岩主", "雷主", "草主"].includes(findReg[1])) {
            regEnd.type = "role";
            regEnd.name = findReg[1];
        } else {
            msg.sendMsgEx({ content: "请选择：风主图鉴、岩主图鉴、雷主图鉴、草主图鉴" });
            return true;
        }
    } else if (roleName) {
        regEnd.type = "role";
        regEnd.name = roleName;
    } else {
        const findedName = await findAliasName(findReg[1]);
        if (findedName) {
            regEnd.name = findedName.name;
            regEnd.type = findedName.type;
        }
    }
    if (!regEnd.type) {
        return;
    }
    const picPath = global.xyResources[regEnd.name];
    if (picPath) msg.sendMsgEx({ imagePath: picPath });



}

export async function handbookHelp(msg: IMessageEx) {
    const isAdmin = await global.redis.hGet(`genshin:config:${msg.author.id}`, "admin");

    const title = helpInfo.handbook.title;
    var helpGroup: {
        group: string;
        list: { css: string; title: string; desc: string; }[];
    }[] = [];
    for (const group of helpInfo.handbook.list) {

        if (group.auth == "admin" && isAdmin != "1") continue;

        const _group: {
            group: string;
            list: { css: string; title: string; desc: string; }[];
        } = { group: group.group, list: [], };
        for (const item of group.list) {
            _group.list.push({
                css: item.icon ?
                    `background-position:-${((item.icon - 1) % 10) * 50}px -${((item.icon - ((item.icon - 1) % 10) - 1) / 10) * 50}px` :
                    `display:none`,
                title: item.title,
                desc: item.desc,
            });

        }

        helpGroup.push(_group);

    }
    render({
        app: "handbook",
        type: "help",
        imgType: "jpeg",
        render: { saveId: msg.author.id, },
        data: {
            element: 'default',
            sys: {
                scale: 1.2,
                copyright: `Created By Yunzai-Bot<span class="version">aaaaa</span> & Miao-Plugin<span class="version">bbbbb</span>`
            },
            defaultLayout: `${global._path}/resources/_common/layout/default.html`,
            //...helpInfo.handbook,
            title,
            helpGroup,
        },
    }).then(savePic => {
        if (typeof savePic == "string")
            return msg.sendMsgEx({ imagePath: savePic });
    }).catch(err => {
        log.error(err);
    });
}

export async function handbookSetting(msg: IMessageEx) {

    if ((await global.redis.hGet(`genshin:config:${msg.author.id}`, "admin")) != "1") return true;

    const rep = /^#图鉴设置(体力|帮助|目录)?(开启|关闭)?$/.exec(msg.content);
    if (rep && (rep[1] && rep[2])) {
        const enable = (rep[2] == "开启") ? "1" : "0";
        var settingType = "";
        switch (rep[1]) {
            case "目录":
                settingType = "dirOpen";
                break;
        }
        if (settingType)
            await global.redis.hSet(`config:handbook`, settingType, enable);
    }



    const dirOpen = (await global.redis.hGet(`config:handbook`, "dirOpen")) == "1";
    const imgPack = fs.existsSync(`${global._path}/resources/_xy`);

    render({
        app: "setting",
        type: "handbook",
        imgType: "jpeg",
        render: { saveId: msg.author.id, },
        data: {
            bg: "bg.png",
            element: 'default',
            setting: {
                dirOpen,
                imgPack,
            },
            sys: {
                scale: 1.2,
                copyright: `Created By Yunzai-Bot<span class="version">aaaaa</span> & Miao-Plugin<span class="version">bbbbb</span>`
            },
            defaultLayout: `${global._path}/resources/_common/layout/default.html`,
            //...helpInfo.handbook,
        },
    }).then(savePic => {
        if (typeof savePic == "string")
            return msg.sendMsgEx({ imagePath: savePic }).then(() => {
                log.mark(`图片已发送，位置${savePic}`);
            });
    }).catch(err => {
        log.error(err);
    });
}

export async function handbookUpdate(msg: IMessageEx) {
    var command = "";
    const resPath = `${global._path}/resources/_xy/`;
    if (fs.existsSync(resPath)) {

        //msg.sendMsgEx({ content: "开始尝试更新，请耐心等待" });
        command = `git pull`;
        let isForce = msg.content.includes("强制");
        if (isForce) {
            command = "git  checkout . && git  pull";
            // command="git fetch --all && git reset --hard origin/master && git pull "
            msg.sendMsgEx({ content: "正在执行强制更新操作，请稍等" });
        } else {
            msg.sendMsgEx({ content: "正在执行更新操作，请稍等" });
        }
        exec(command, {
            cwd: resPath
        }, function (error, stdout, stderr) {
            //console.log(stdout);
            if (/Already up to date/.test(stdout) || stdout.includes("最新")) {
                msg.sendMsgEx({ content: "目前所有图片均已最新" });
                return true;
            }
            let numRet = /(\d*) files changed,/.exec(stdout);
            if (numRet && numRet[1]) {
                msg.sendMsgEx({ content: `报告主人，更新成功，此次更新了${numRet[1]}个图片~` });
                return true;
            }
            if (error) {
                msg.sendMsgEx({ content: `更新失败！\nError code: ${error.code}\n${error.stack}\n 请稍后重试。` });
            } else {
                msg.sendMsgEx({ content: "图片加量包更新成功~" });
            }
        });
    } else {
        //gitee图床
        command = `git clone https://gitee.com/Ctrlcvs/xiaoyao-plus.git "${resPath}"`;
        // command = `git clone https://github.com/ctrlcvs/xiaoyao_plus.git "${resPath}/xiaoyao-plus/"`;\n此链接为github图床,如异常请请求多次
        msg.sendMsgEx({ content: "开始尝试安装图鉴加量包，可能会需要一段时间，请耐心等待" });
        log.mark(`正在使用指令${command}更新图鉴中`);
        exec(command, function (err, stdout, stderr) {
            if (err) {
                log.error(err);
                msg.sendMsgEx({ content: `图鉴加量包安装失败！\nError code: ${err.code}\n${err.stack}\n 请稍后重试。` }).catch(err => { log.error(err) });
            } else {
                msg.sendMsgEx({ content: "图鉴加量包安装成功！您后续也可以通过 #图鉴更新 命令来更新图像" }).catch(err => {
                    log.error(err);
                    return msg.sendMsgEx({ content: "图鉴加量包安装成功！您后续也可以通过 #图鉴更新 命令来更新图像", initiative: true });
                }).catch(err => {
                    log.error(err);
                });
            }
        });
    }
}

async function findAliasName(findName: string): Promise<{ name: string; type: string; } | null> {
    for (const type of typeList) {
        const path = `${global._path}/data/xy/alias/${type}.json`;
        const typeMap: { [key: string]: string[] } = (await import(path)).default;
        for (const key in typeMap) {
            for (const aliasName of typeMap[key]) {
                if (aliasName == findName)
                    return { name: key, type };
            }
        }
    }
    return null;
}