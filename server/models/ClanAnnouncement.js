import mongoose from "mongoose";

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
    // createdAt: {
    //     type: Date,
    //     default: Date.now,
    // },
    // updatedAt: {
    //     type: Date,
    //     default: Date.now,
    // },
}, { timestamps: true });

const ClanAnnouncement = mongoose.model("ClanAnnouncement", clanAnnouncementSchema);

export default ClanAnnouncement;