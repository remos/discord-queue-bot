import {
    Client,
    TextChannel,
    Collection,
    Snowflake,
    Message
} from 'discord.js';
import {readFileSync} from 'fs';
import * as path from 'path';

import {ReactionQueue, ReactionQueueOptions} from './ReactionQueue';

type QueueConfiguration = (ReactionQueueOptions & {
    title: string;
});

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

export async function clearChannel(channel: TextChannel): Promise<Collection<Snowflake, Message>> {
    console.info(`Clearing ${channel.name}`);
    return channel.bulkDelete(await channel.messages.fetch());
}

async function initialise({
    token,
    channels
}: Config): Promise<ReactionQueue[]> {
    return new Promise((resolve, reject) => {
        const client = new Client();

        client.on('ready', async () => {
            console.info(`Logged in as ${client.user.tag}`);

            Promise.all(
                Object.keys(channels).map(async channelId => {
                    const channel = await client.channels.fetch(channelId);
                    if(channel.type !== 'text') {
                        throw `Joined non-text channel ${channelId}`;
                    }

                    console.info(`Joined ${(channel as TextChannel).name}`);

                    if(channels[channelId].clear) {
                        await clearChannel(channel as TextChannel);
                    }

                    return channels[channelId].queues.map(queueConfiguration => {
                        console.info(`Creating queue titled ${queueConfiguration.title}`);
                
                        return new ReactionQueue(
                            channel as TextChannel,
                            queueConfiguration.title,
                            queueConfiguration
                        );
                    });
                })
            ).then(queueArrays => queueArrays.flat())
            .then(resolve)
            .catch(reject);
        });

        client.on('error', (e) => {
            console.error(e);
        });

        client.login(token);
    });
}

export async function fromConfig(configPath='./config.json'): Promise<ReactionQueue[]> {
    configPath = path.resolve(configPath);
    
    let config: Config;

    try {
        config = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch(err) {
        if(err.code === 'ENOENT') {
            throw `${configPath} cannot be found`;
        }
    }

    return initialise(config);
}