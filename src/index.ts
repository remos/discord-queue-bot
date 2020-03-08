#!/usr/bin/env node

import {Client, TextChannel, Collection, Snowflake, Message} from 'discord.js';
import {readFileSync} from 'fs';

import {createQueue} from './Queue';

interface Config {
    token: string;
    channelId: string;
}

const {token, channelId}: Config = JSON.parse(readFileSync('./config.json', 'utf8'));

const client = new Client();

async function clearChannel(channel: TextChannel): Promise<Collection<Snowflake, Message>> {
    console.log(`Clearing ${channel.name}`);
    return channel.bulkDelete(await channel.messages.fetch());
}

client.on('ready', async ()=>{
    console.log(`Logged in as ${client.user.tag}`);

    const channel = await client.channels.fetch(channelId);
    if(channel.type === 'text') {
        clearChannel(channel as TextChannel);
        await createQueue(channel as TextChannel, 'Waiting for slot', {
            maxActive: 5
        });

        await createQueue(channel as TextChannel, 'FTO', {
            paired: true,
            pendingTimeout: 600000
        });
    } else {
        throw 'Joined non-text channel';
    }
});

client.on('error', (e)=>{
    console.error(e);
});

client.login(token);