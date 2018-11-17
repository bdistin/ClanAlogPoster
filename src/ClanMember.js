// Import the node-fetch module
const fetch = require('node-fetch');

/**
 * Handles clan members, and keeps track of if we should continue getting activities for them
 */
class ClanMember {

    /**
     * @typedef {object} Activity
     * @property {string} date The date of the activity
     * @property {string} text The text of the activity
     * @property {string} description The description of the activity
     */

    /**
     * @param {Client} client The client that manages this ClanMember
     * @param {string} name The name of the clan member
     * @param {string} [lastEvent] The last event we have fetched for this member
     */
    constructor(client, name, lastEvent) {
        /**
         * The Client
         * @type {Client}
         */
        this.client = client;

        /**
         * The clan members name
         * @type {string}
         */
        this.name = name;

        /**
         * The last event we have displayed for this clan member
         * @type {?Date}
         */
        this.lastEvent = lastEvent ? new Date(lastEvent) : null;

        /**
         * The number of fetch errors we have had for this clan member (resets on a success)
         * @type {number}
         */
        this.errorsFetching = 0;
    }

    /**
     * If we consider this clan member active
     * @type {boolean}
     */
    get active() {
        return this.errorsFetching < this.client.errorLimit;
    }

    /**
     * Gets activities for this clan member
     * @returns {Activity[]}
     */
    async getActivities() {
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

    /**
     * Defines the json.stringify behavior of class instances
     * @returns {object}
     */
    toJSON() {
        return {
            name: this.name,
            lastEvent: this.lastEvent && this.lastEvent.toString()
        }
    }

}

module.exports = ClanMember;