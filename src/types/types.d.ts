import log4js from "log4js";
import { Browser } from "puppeteer";
import { RedisClientType } from "@redis/client";
import { IMessage } from "qq-guild-bot";
import { OpenAPI, WebsocketClient } from "./qq-guild-bot";


declare global {
  var _path: string;
  var devEnv: boolean;
  var client: OpenAPI;
  var adminId: string[];
  var ws: WebsocketClient;
  var redis: RedisClientType;
  var browser: Browser | null;
  var saveGuildsTree: SaveGuild[];
  var botStatus: {
    startTime: Date;
    msgSendNum: number;
    imageRenderNum: number;
  }
  var xyResources: {
    [name: string]: string;
  };

  var log: log4js.Logger;

  interface IntentMessage {
    eventType: "MESSAGE_CREATE" | "PUBLIC_MESSAGE_DELETE" | "GUILD_MEMBER_REMOVE" | "GUILD_MEMBER_ADD" | "GUILD_MEMBER_UPDATE" | "DIRECT_MESSAGE_CREATE",
    eventId: string,
    msg: IMessage & GUILD_MEMBER,
  }

  interface GUILD_MEMBER {
    guild_id: string;
    joined_at: string;
    nick: string;
    op_user_id: string;
    roles?: string[];
    user: {
      avatar: string;
      bot: boolean;
      id: string;
      username: string;
    };
  }

  interface SaveGuild {
    name: string,
    id: string,
    channel: SaveChannel[],
  }

  interface SaveChannel {
    name: string,
    id: string,
  }

  interface MihoyoAPI<T> {
    retcode: number;
    message: string;
    data: T | null;
  }


}

