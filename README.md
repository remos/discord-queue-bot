## Quick start
Clone, then install dependencies `yarn` or `npm i`

copy `config.example.json` to `config.json`, and fill in your token and channel id (you'll need to add your bot to your server beforehand)

Run using `yarn start` or `npm run start`

Configure queue settings in [src/index.ts](src/index.ts). See `QueueOptions` in [src/ReactionQueue.ts](src/ReactionQueue.ts) for available options