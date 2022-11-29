import fs from "fs";
import puppeteer from "puppeteer";
import template from "art-template";
import { writeFileSyncEx } from "./common";
import { RandQueue } from "../plugins/gacha";

//html模板
const html: any = {};
//截图数达到时重启浏览器 避免生成速度越来越慢
var restartNum = 400;
//截图次数
var renderNum = 0;
//锁住
var lock = false;
//截图中
var shoting: any[] = [];

export async function render(renderData: Render) {

    //log.debug(renderData);
    if (renderData.render.template) renderData.render.resFile = `${global._path}/resources/${renderData.app}/${renderData.type}/${renderData.render.template}.html`;
    else renderData.render.resFile = `${global._path}/resources/${renderData.app}/${renderData.type}/index.html`;

    if (!renderData.render.saveFile)
        renderData.render.saveFile = `${global._path}/generate/html/${renderData.app}/${renderData.type}/${renderData.render.saveId}.html`;
    if (!renderData.data.resPath)
        renderData.data.resPath = `${global._path}/resources`;
    //renderData.data.resPath = `/resources`;//测试用

    return await doRender(renderData).catch(err => {
        log.error(err);
    });
}

async function doRender(renderData: Render): Promise<string | null> {

    var { app, type, imgType, render, data } = renderData;

    const savePic = `${render.saveFile}.${imgType}`;
    html[`${app}.${type}`] = fs.readFileSync(render.resFile!, "utf8");

    var tmpHtml = template.render(html[`${app}.${type}`], data);
    writeFileSyncEx(render.saveFile!, tmpHtml);

    if (!(await browserInit())) return null;
    if (!global.browser) return null;

    const page = await global.browser.newPage();

    await page.goto(`file://${renderData.render.saveFile}`, {
        waitUntil: "networkidle0",
    }).then(() => {
        return page.$("#container");
    }).then(body => {
        return body?.screenshot({
            type: imgType,
            encoding: "binary",
            quality: 100,
            path: savePic,
        });
    }).catch(err => {
        log.error(err);
    });
    await page.close();
    if (fs.existsSync(savePic)) {
        global.botStatus.imageRenderNum++;
        return savePic;
    } else {
        return null;
    }
}

export async function renderURL(renderData: RenderURL) {

    var { app, type, imgType, url, saveId } = renderData;

    const savePath = `${global._path}/generate/url/${app}/${type}/${saveId}.${imgType}`;


    if (!(await browserInit())) return false;
    if (!global.browser) return false;

    const page = await global.browser.newPage();
    await page.goto(url, {
        waitUntil: "networkidle0",
    });
    await page.evaluate(() => {
        document.querySelector("#__layout > div > div.header")?.remove();

    });
    //log.debug(`goto${url}`);
    await page.$("#__layout > div > div.root-page-container > div > div.mhy-layout__main > div.mhy-article-page__main.mhy-container").then(f => {
        //log.debug(f);
        if (f) {
            return f.screenshot({
                type: imgType,
                encoding: "binary",
                quality: 100,
                path: savePath,
            });
        }
    }).catch(err => {
        log.error(err);
    });
    await page.close();
    return savePath;
}

async function browserInit() {
    if (global.browser) {
        if (devEnv) log.debug(`puppeteer已经启动`);
        return true;
    }
    if (lock) {
        return false;
    }
    lock = true;
    log.info("puppeteer启动中");
    //初始化puppeteer
    await puppeteer.launch({
        // executablePath:'',//chromium其他路径
        headless: true,
        args: [
            "--disable-gpu",
            "--disable-dev-shm-usage",
            "--disable-setuid-sandbox",
            "--no-first-run",
            "--no-sandbox",
            "--no-zygote",
            "--single-process",
        ],
    }).then(_browser => {
        global.browser = _browser;
        log.info("puppeteer启动成功");
        global.browser.on("disconnected", function () {
            log.error("Chromium实例关闭或崩溃！");
            global.browser = null;
        });
    }).catch((err) => {
        log.error(err);
    });
    lock = false;

    return true;
}




interface Render {
    app: string;
    type: string;
    imgType: "jpeg" | "png";
    render: {
        saveId: string;
        resFile?: string;
        saveFile?: string;
        template?: string;
    };
    data: any;
};

interface RenderURL {
    app: string;
    type: string;
    imgType: "jpeg" | "png";
    url: string;
    saveId: string;

};

interface RenderGachaData {
    saveId: string;
    name: string;
    info: string;
    list: RandQueue[];
    resPath?: string;
    poolName: string;
};
