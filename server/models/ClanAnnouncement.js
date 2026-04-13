const mongoose = require('mongoose');

const clanAnnouncementSchema = new mongoose.Schema({
    clanId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Clan",
        required: true,
    },
    title: {
        type: String,
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
}, { timestamps: true });

module.exports = mongoose.model("ClanAnnouncement", clanAnnouncementSchema);