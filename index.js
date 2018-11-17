// Import the discord.js module
const Discord = require('discord.js');
// Import the fs-nextra module
const fs = require('fs-nextra');
// Import the node-fetch module
const fetch = require('node-fetch');

// Import promisify from node.js's util
const { promisify } = require('util')
// Define an async timout
const sleep = promisify(setTimeout);

// Import our config
const config = require('./config.json');
// Create a new webhook connection
const hook = new Discord.WebhookClient(config.webhookID, config.webhookToken);

// Send a message using the webhook
hook.send('I am now alive!');

class Main {

    constructor() {
        this.clanMembers = new Map();
    }

    async start() {
        try {
            const members = await fs.readJSON('./clanmembers.json');
            for (const member of members) this.createMember(member.name, member.lastEvent);
        } catch (err) {
            await fs.createFileAtomic('./clanmembers.json');
        }
        return this.loop();
    }

    createMember(name, lastEvent) {
        this.clanMembers.set(name, new ClanMember(name, lastEvent));
    }

    save() {
        return fs.writeJSONAtomic('./clanmembers.json', [...this.clanMembers.values()]);
    }

    sleep() {
        // sleep 5 seconds plus a random fraction of a second
        return sleep(5000 + (Math.random() * 1000));
    }

    async loop() {
        console.log('getting members');
        await this.getMemberList();
        console.log('looping members');
        await this.loopMembers();
        return this.loop();
    }

    async getMemberList() {
        try {
            const membersString = await fetch(`http://services.runescape.com/m=clan-hiscores/members_lite.ws?clanName=${encodeURIComponent(config.clan)}`).then(res => res.text());
            const members = membersString.split('\n').map(memberString => memberString.split(',')[0].replace(' ', '_')).slice(1);

            // Removes any members that may not be in the clan any longer
            const membersClone = new Map(this.clanMembers);
            this.clanMembers.clear();

            for (const member of members) {
                const existing = membersClone.get(member);

                if (existing) this.clanMembers.set(existing.name, existing);
                else this.createMember(member);
            }
        } catch (error) {
            console.error(error);
            process.exit();
        }
        return this.sleep();
    }

    async loopMembers() {
        for (const member of this.clanMembers.values()) {
            if (!member.updateable) continue;
            const activities = await member.update();
            if (activities.length) await hook.send(activities.map(activity => `${member.name}: ${activity.text}`).join('\n'));
            await this.save();
            await this.sleep();
        }
    }

}

class ClanMember {

    constructor(name, lastEvent) {
        this.name = name;
        this.lastEvent = lastEvent || null;
        this.errorsFetching = 0;
        // coerce to a date
        if (this.lastEvent) this.lastEvent = new Date(this.lastEvent);
    }

    get updateable() {
        return this.errorsFetching < config.errorLimit;
    }

    async update() {
        try {
            const data = await fetch(`https://apps.runescape.com/runemetrics/profile/profile?user=${encodeURIComponent(this.name)}&activities=20`).then(res => res.json());
            if (data.error) throw data.error;
            this.errorsFetching = 0;
            const activities = data.activities.filter(activity => new Date(activity.date) > (this.lastEvent || 0)).reverse();
            if (activities.length) this.lastEvent = new Date(activities[activities.length - 1].date);
            return activities;
        } catch (err) {
            this.errorsFetching++;
            return [];
        }
    }

    toJSON() {
        return {
            name: this.name,
            lastEvent: this.lastEvent && this.lastEvent.toString()
        }
    }

}

new Main().start();