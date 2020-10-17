import {
  Client,
  TextChannel,
  Collection,
  Snowflake,
  Message,
} from "discord.js";
import { readFileSync } from "fs";
import * as path from "path";

import { ReactionQueue, ReactionQueueOptions } from "./ReactionQueue";

type QueueConfiguration = ReactionQueueOptions & {
  title: string;
};

type ChannelConfiguration = {
  clear?: boolean;
  queues: QueueConfiguration[];
};

export interface Config {
  token: string;
  channels: {
    [id: string]: ChannelConfiguration;
  };
}

/**
 * Deletes up to 100 messages from the channel provided they are within the last 14 days
 * @param channel
 * @param excludedMessages
 */
export async function clearChannel(
  channel: TextChannel,
  excludedMessages: (Message | Snowflake)[] = []
): Promise<[Collection<Snowflake, Message>, Collection<Snowflake, Message>]> {
  console.info(`Clearing ${channel.name}`);

  const messages = await channel.messages.fetch({
    limit: 100,
  });

  const bulkDeleteAfter = Date.now() - 3600 * 24 * 14;

  const deletedMessages = new Collection<Snowflake, Message>();
  const remainingMessages = new Collection<Snowflake, Message>();

  for (const [key, message] of messages.entries()) {
    if (
      message.deletable &&
      excludedMessages.findIndex((excludedMessage) =>
        excludedMessage instanceof Message
          ? excludedMessage.id === message.id
          : excludedMessage === message.id
      ) < 0
    ) {
      if (message.createdTimestamp > bulkDeleteAfter) {
        deletedMessages.set(key, message);
      } else {
        remainingMessages.set(key, message);
      }
    }
  }

  const messageCount = deletedMessages.size;

  if (messageCount === 1) {
    const deletedMessage = await deletedMessages
      .get(deletedMessages.firstKey())
      .delete();

    return [
      new Collection<Snowflake, Message>().set(
        deletedMessage.id,
        deletedMessage
      ),
      remainingMessages,
    ];
  } else if (messageCount < 100) {
    return [await channel.bulkDelete(deletedMessages), remainingMessages];
  } else {
    return [new Collection(), remainingMessages.concat(deletedMessages)];
  }
}

async function initialise({
  token,
  channels,
}: Config): Promise<ReactionQueue[]> {
  return new Promise((resolve, reject) => {
    const client = new Client();

    client.on("ready", async () => {
      console.info(`Logged in as ${client.user.tag}`);

      Promise.all(
        Object.keys(channels).map(async (channelId) => {
          const channel = await client.channels.fetch(channelId);
          if (channel.type !== "text") {
            throw `Joined non-text channel ${channelId}`;
          }

          console.info(`Joined ${(channel as TextChannel).name}`);

          if (channels[channelId].clear) {
            const [, remainingMessages] = await clearChannel(
              channel as TextChannel
            );
            if (remainingMessages.size > 0) {
              console.info(
                `Unable to delete ${remainingMessages.size} message${
                  remainingMessages.size === 1 ? "" : "s"
                }`
              );
            }
          }

          return channels[channelId].queues.map((queueConfiguration) => {
            console.info(`Creating queue titled ${queueConfiguration.title}`);

            return new ReactionQueue(
              channel as TextChannel,
              queueConfiguration.title,
              queueConfiguration
            );
          });
        })
      )
        .then((queueArrays) => queueArrays.flat())
        .then(resolve)
        .catch(reject);
    });

    client.on("error", (e) => {
      console.error(e);
    });

    client.login(token);
  });
}

export async function fromConfig(
  configPath = "./config.json"
): Promise<ReactionQueue[]> {
  configPath = path.resolve(configPath);

  let config: Config;

  try {
    config = JSON.parse(readFileSync(configPath, "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") {
      throw `${configPath} cannot be found`;
    }
  }

  return initialise(config);
}
