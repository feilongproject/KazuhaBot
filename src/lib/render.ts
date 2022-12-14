import fs from "fs";
import puppeteer from "puppeteer";
import template from "art-template";
import { writeFileSyncEx } from "./common";

var lock = false;//锁住

export async function render(renderData: Render): Promise<string | null> {

    const { app, saveId, data, templateName } = renderData;
    const resFile = `${_path}/resources/${app}/${templateName || "index"}.html`;
    const saveFile = `${_path}/generate/html/${app}/${saveId}.html`;
    const savePic = `${saveFile}.png`;
    data.resPath = `${_path}/resources`;
    //log.debug(data, resFile, saveFile, savePic);
    const tmpHtml = template.render(fs.readFileSync(resFile, "utf8"), data);
    writeFileSyncEx(saveFile, tmpHtml);

    if (!(await browserInit())) return null;
    if (!browser) return null;
    const page = await browser.newPage();
    await page.goto(`file://${saveFile}`, {
        waitUntil: "networkidle0",
    }).then(() => {
        return page.$("#container");
    }).then(body => {
        return body?.screenshot({
            encoding: "binary",
            quality: 100,
            type: "jpeg",
            path: savePic,
        });
    }).catch(err => {
        log.error(err);
    });
    await page.close();
    if (fs.existsSync(savePic)) {
        global.botStatus.imageRenderNum++;
        return savePic;
    } else return null;

}

async function browserInit() {
    if (global.browser) {
        if (devEnv) log.debug(`puppeteer已经启动`);
        return true;
    }
    if (lock) return false;
    lock = true;
    log.info("puppeteer启动中");

    await puppeteer.launch({
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
    saveId: string;
    data: { [key: string]: any };
    templateName?: string;
};