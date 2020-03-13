#!/usr/bin/env node

import {Client, TextChannel, Collection, Snowflake, Message} from 'discord.js';
import {readFileSync} from 'fs';

import {ReactionQueue, ReactionQueueOptions} from './ReactionQueue';

interface Config {
    token: string;
    channelId: string;
    clearChannel?: boolean;
    queues: (ReactionQueueOptions & {
        title: string;
    })[];
}

const {
    token,
    channelId,
    clearChannel: shouldClearChannel=false,
    queues
}: Config = JSON.parse(readFileSync('./config.json', 'utf8'));

const client = new Client();

async function clearChannel(channel: TextChannel): Promise<Collection<Snowflake, Message>> {
    console.info(`Clearing ${channel.name}`);
    return channel.bulkDelete(await channel.messages.fetch());
}

client.on('ready', async ()=>{
    console.info(`Logged in as ${client.user.tag}`);

    const channel = await client.channels.fetch(channelId);
    if(channel.type !== 'text') {
        throw 'Joined non-text channel';
    }

    console.info(`Joined ${(channel as TextChannel).name}`);

    // Clear the bot channel
    if(shouldClearChannel) {
        await clearChannel(channel as TextChannel);
    }

    for(const queueConfiguration of queues) {
        console.info(`Creating queue titled ${queueConfiguration.title}`);
        
        new ReactionQueue(
            channel as TextChannel,
            queueConfiguration.title,
            queueConfiguration
        );
    }
});

client.on('error', (e)=>{
    console.error(e);
});

client.login(token);