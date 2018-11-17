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

const ClanMember = require('./ClanMember');

/**
 * The client to manage the api loop and ratelimits
 */
class Client {

    /**
     * @param {object} config The configuration for this Client
     * @property {string} config.webhookID The id of the webhook to post to
     * @property {string} config.webhookToken The token for posting to the webhook
     * @property {string} config.clan The name of the clan to post activities from
     * @property {number} config.errorLimit The number of errors before the client starts skipping checking them
     */
    constructor(config) {
        /**
         * The webhook connection to post to
         * @type {external:WebhookClient}
         */
        this.webhook = new Discord.WebhookClient(config.webhookID, config.webhookToken);

        /**
         * The name of the clan to post activities from
         * @type {string}
         */
        this.clanName = config.clan;

        /**
         * The ClanMember cache
         * @type {Map<string, ClanMember>}
         */
        this.clanMembers = new Map();

        /**
         * The number of errors before the client starts skipping checking them
         * @type {number}
         */
        this.errorLimit = config.errorLimit;

        this.webhook.send('I am now alive!');
    }

    /**
     * Starts this client checking for activities
     * @returns {Promise<void>}
     */
    async start() {
        try {
            const members = await fs.readJSON('./clanmembers.json');
            for (const member of members) this.createMember(member.name, member.lastEvent);
        } catch (err) {
            await fs.createFileAtomic('./clanmembers.json');
        }
        return this.loop();
    }

    /**
     * Creates and caches a new ClanMember to track activities
     * @param {string} name The name of the clan member
     * @param {string} [lastEvent] The last event recorded from them
     * @returns {void}
     */
    createMember(name, lastEvent) {
        this.clanMembers.set(name, new ClanMember(this, name, lastEvent));
    }

    /**
     * Saves the current cache to file, so activites are not posted multiple times
     * @returns {Promise<void>}
     */
    async save() {
        await fs.writeJSONAtomic('./clanmembers.json', [...this.clanMembers.values()]);
    }

    /**
     * Sleeps an amount of time between api requests
     * @returns {Promise<void>}
     */
    async sleep() {
        // sleep 5 seconds plus a random fraction of a second
        await sleep(5000 + (Math.random() * 1000));
    }

    /**
     * The Activity checking loop
     * @returns {Promise<void>}
     */
    async loop() {
        console.log('getting members');
        await this.getMemberList();
        console.log('looping members');
        await this.loopMembers();
        return this.loop();
    }

    /**
     * Gets the clan member list from the api and updates the local cache
     * @returns {Promise<void>}
     */
    async getMemberList() {
        try {
            const membersString = await fetch(`http://services.runescape.com/m=clan-hiscores/members_lite.ws?clanName=${encodeURIComponent(this.clanName)}`).then(res => res.text());
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

    /**
     * Loops through the members and gets their activities
     * @returns {Promise<void>}
     */
    async loopMembers() {
        for (const member of this.clanMembers.values()) {
            if (!member.active) continue;
            const activities = await member.getActivities();
            if (activities.length) await hook.send(activities.map(activity => `${member.name}: ${activity.text}`).join('\n'));
            await this.save();
            await this.sleep();
        }
    }

}

module.exports = Client;