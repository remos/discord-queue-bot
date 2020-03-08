#!/usr/bin/env node

import {Client, TextChannel, Collection, Snowflake, Message, User} from 'discord.js';
import {readFileSync} from 'fs';

import {ReactionQueue} from './ReactionQueue';

interface Config {
    token: string;
    channelId: string;
}

const {token, channelId}: Config = JSON.parse(readFileSync('./config.json', 'utf8'));

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
    // await clearChannel(channel as TextChannel);

    new ReactionQueue(channel as TextChannel, 'Waiting for slot', {
        maxActive: 5,
        userToString: (user: User): string=>user.toString()
    });

    new ReactionQueue(channel as TextChannel, 'FTO', {
        paired: true,
        pendingTimeout: 600000
    });
});

client.on('error', (e)=>{
    console.error(e);
});

client.login(token);