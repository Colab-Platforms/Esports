const mongoose = require('mongoose');

const gameServerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Server name is required'],
        trim: true
    },
    gameType: {
        type: String,
        required: [true, 'Game type is required'],
        enum: {
            values: ['cs2', 'valorant'],
            message: 'Game type must be cs2 or valorant'
        }
    },
    serverDetails: {
        ip: {
            type: String,
            required: [true, 'Server IP is required'],
            match: [/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/, 'Please enter a valid IP address']
        },
        port: {
            type: String,
            required: [true, 'Server port is required'],
            match: [/^\d{1,5}$/, 'Please enter a valid port number']
        },
        password: {
            type: String,
            default: ''
        },
        rconPassword: {
            type: String,
            default: ''
        }
    },
    region: {
        type: String,
        required: [true, 'Server region is required'],
        enum: {
            values: ['mumbai', 'delhi', 'bangalore', 'chennai', 'kolkata', 'singapore'],
            message: 'Invalid server region'
        }
    },
    maxPlayers: {
        type: Number,
        required: [true, 'Max players is required'],
        min: [2, 'Server must support at least 2 players'],
        max: [64, 'Server cannot support more than 64 players']
    },
    currentPlayers: {
        type: Number,
        default: 0,
        min: 0
    },
    status: {
        type: String,
        enum: {
            values: ['online', 'offline', 'maintenance', 'full'],
            message: 'Invalid server status'
        },
        default: 'online'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    steamRequired: {
        type: Boolean,
        default: true // CS2 requires Steam, Valorant doesn't
    },
    serverConfig: {
        tickRate: {
            type: Number,
            default: 128
        },
        gameMode: {
            type: String,
            default: 'competitive'
        },
        mapPool: [{
            type: String,
            default: ['de_dust2', 'de_mirage', 'de_inferno', 'de_cache', 'de_overpass']
        }],
        roundTime: {
            type: Number,
            default: 115 // seconds
        },
        freezeTime: {
            type: Number,
            default: 15 // seconds
        }
    },
    performance: {
        averagePing: {
            type: Number,
            default: 0
        },
        uptime: {
            type: Number,
            default: 99.9 // percentage
        },
        lastPingCheck: {
            type: Date,
            default: Date.now
        }
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Server creator is required']
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for server address
gameServerSchema.virtual('serverAddress').get(function () {
    return `${this.serverDetails.ip}:${this.serverDetails.port}`;
});

// Virtual for connect command (CS2)
gameServerSchema.virtual('connectCommand').get(function () {
    if (this.gameType === 'cs2') {
        const password = this.serverDetails.password ? `; password ${this.serverDetails.password}` : '';
        return `connect ${this.serverDetails.ip}:${this.serverDetails.port}${password}`;
    }
    return '';
});

// Virtual for server capacity
gameServerSchema.virtual('capacity').get(function () {
    return `${this.currentPlayers}/${this.maxPlayers}`;
});

// Virtual for availability
gameServerSchema.virtual('isAvailable').get(function () {
    return this.status === 'online' && this.currentPlayers < this.maxPlayers && this.isActive;
});

// Indexes for efficient queries
gameServerSchema.index({ gameType: 1, region: 1, status: 1 });
gameServerSchema.index({ isActive: 1, status: 1 });
gameServerSchema.index({ createdBy: 1 });

// Method to update player count
gameServerSchema.methods.updatePlayerCount = function (count) {
    this.currentPlayers = Math.max(0, Math.min(count, this.maxPlayers));

    // Update status based on player count
    if (this.currentPlayers >= this.maxPlayers) {
        this.status = 'full';
    } else if (this.status === 'full' && this.currentPlayers < this.maxPlayers) {
        this.status = 'online';
    }

    return this.save();
};

// Method to check server availability
gameServerSchema.methods.checkAvailability = function () {
    return this.isActive &&
        this.status === 'online' &&
        this.currentPlayers < this.maxPlayers;
};

// Static method to get available servers
gameServerSchema.statics.getAvailableServers = function (gameType, region = null) {
    const query = {
        gameType,
        isActive: true,
        status: 'online',
        $expr: { $lt: ['$currentPlayers', '$maxPlayers'] }
    };

    if (region) {
        query.region = region;
    }

    return this.find(query)
        .populate('createdBy', 'username')
        .sort({ currentPlayers: 1, 'performance.averagePing': 1 });
};

// Static method to get server by region preference
gameServerSchema.statics.getBestServer = function (gameType, preferredRegion = 'mumbai') {
    return this.findOne({
        gameType,
        region: preferredRegion,
        isActive: true,
        status: 'online',
        $expr: { $lt: ['$currentPlayers', '$maxPlayers'] }
    }).populate('createdBy', 'username');
};

module.exports = mongoose.model('GameServer', gameServerSchema);