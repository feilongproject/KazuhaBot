import { RedisClientType } from "@redis/client";
import { Browser } from "puppeteer";
import { Ark, Embed, IMember, IMessage, IUser, MessageAttachment, OpenAPI, WebsocketClient } from "qq-guild-bot"

declare global {
  var client: OpenAPI;
  var ws: WebsocketClient;
  var redis: RedisClientType;
  var browser: Browser | null;

  interface IntentMessage {
    eventType: "MESSAGE_CREATE" | "PUBLIC_MESSAGE_DELETE" | "GUILD_MEMBER_REMOVE" | "GUILD_MEMBER_ADD" | "GUILD_MEMBER_UPDATE",
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

