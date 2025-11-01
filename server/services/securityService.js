const SecurityLog = require('../models/SecurityLog');
const FlaggedAccount = require('../models/FlaggedAccount');
const User = require('../models/User');
const Match = require('../models/Match');

class SecurityService {
    // Log security events
    static async logSecurityEvent(eventData) {
        try {
            const securityLog = new SecurityLog({
                userId: eventData.userId,
                eventType: eventData.eventType,
                severity: eventData.severity || 'medium',
                description: eventData.description,
                metadata: eventData.metadata || {},
                status: 'pending'
            });

            await securityLog.save();
            console.log(`🔒 Security event logged: ${eventData.eventType} for user ${eventData.userId}`);

            // Auto-escalate critical events
            if (eventData.severity === 'critical') {
                await this.escalateSecurityEvent(securityLog._id);
            }

            return securityLog;
        } catch (error) {
            console.error('❌ Error logging security event:', error);
            throw error;
        }
    }

    // Detect duplicate IP addresses
    static async detectDuplicateIPs(userId, ipAddress) {
        try {
            // Find other users with the same IP address
            const duplicateUsers = await SecurityLog.find({
                'metadata.ipAddress': ipAddress,
                userId: { $ne: userId },
                eventType: { $in: ['login_attempt', 'duplicate_ip'] }
            }).populate('userId', 'username email');

            if (duplicateUsers.length > 0) {
                // Log the duplicate IP detection
                await this.logSecurityEvent({
                    userId,
                    eventType: 'duplicate_ip',
                    severity: 'medium',
                    description: `User sharing IP address with ${duplicateUsers.length} other accounts`,
                    metadata: {
                        ipAddress,
                        duplicateAccounts: duplicateUsers.map(log => ({
                            userId: log.userId._id,
                            username: log.userId.username
                        }))
                    }
                });

                // Check if this should trigger account flagging
                if (duplicateUsers.length >= 3) {
                    await this.flagAccount(userId, {
                        reason: 'multiple_ip_addresses',
                        severity: 'high',
                        description: `Account sharing IP with ${duplicateUsers.length} other accounts`,
                        evidence: {
                            ipAddresses: [{
                                ip: ipAddress,
                                firstSeen: new Date(),
                                lastSeen: new Date(),
                                frequency: duplicateUsers.length + 1
                            }]
                        }
                    });
                }

                return {
                    isDuplicate: true,
                    duplicateCount: duplicateUsers.length,
                    duplicateUsers: duplicateUsers.map(log => ({
                        userId: log.userId._id,
                        username: log.userId.username
                    }))
                };
            }

            return { isDuplicate: false, duplicateCount: 0 };
        } catch (error) {
            console.error('❌ Error detecting duplicate IPs:', error);
            throw error;
        }
    }

    // Analyze suspicious activity patterns
    static async analyzeSuspiciousActivity(userId, activityData) {
        try {
            const suspiciousFlags = [];

            // Check for impossible performance metrics
            if (activityData.killsPerMinute > 5) {
                suspiciousFlags.push({
                    type: 'impossible_performance',
                    description: 'Kills per minute exceeds human capability',
                    severity: 'high'
                });
            }

            if (activityData.accuracyPercentage > 95) {
                suspiciousFlags.push({
                    type: 'suspicious_accuracy',
                    description: 'Accuracy percentage unusually high',
                    severity: 'medium'
                });
            }

            if (activityData.headShotRatio > 0.8) {
                suspiciousFlags.push({
                    type: 'suspicious_headshot_ratio',
                    description: 'Headshot ratio indicates possible aimbot',
                    severity: 'high'
                });
            }

            // Log suspicious activity if flags found
            if (suspiciousFlags.length > 0) {
                await this.logSecurityEvent({
                    userId,
                    eventType: 'suspicious_activity',
                    severity: suspiciousFlags.some(f => f.severity === 'high') ? 'high' : 'medium',
                    description: `Suspicious activity detected: ${suspiciousFlags.map(f => f.type).join(', ')}`,
                    metadata: {
                        suspiciousMetrics: activityData,
                        flags: suspiciousFlags
                    }
                });

                // Auto-flag account if multiple high-severity flags
                const highSeverityFlags = suspiciousFlags.filter(f => f.severity === 'high');
                if (highSeverityFlags.length >= 2) {
                    await this.flagAccount(userId, {
                        reason: 'suspicious_performance',
                        severity: 'high',
                        description: 'Multiple high-severity performance anomalies detected',
                        evidence: {
                            performanceMetrics: {
                                averageKDA: activityData.kdRatio,
                                suspiciousMatches: [{
                                    matchId: activityData.matchId,
                                    reason: 'Performance anomalies',
                                    metrics: activityData
                                }]
                            }
                        }
                    });
                }
            }

            return {
                isSuspicious: suspiciousFlags.length > 0,
                flags: suspiciousFlags,
                riskLevel: this.calculateRiskLevel(suspiciousFlags)
            };
        } catch (error) {
            console.error('❌ Error analyzing suspicious activity:', error);
            throw error;
        }
    }

    // Flag an account for review
    static async flagAccount(userId, flagData) {
        try {
            // Check if account is already flagged
            let flaggedAccount = await FlaggedAccount.findOne({ userId });

            if (flaggedAccount) {
                // Update existing flag
                flaggedAccount.flagReason = flagData.reason;
                flaggedAccount.severity = flagData.severity;
                flaggedAccount.description = flagData.description;
                flaggedAccount.evidence = { ...flaggedAccount.evidence, ...flagData.evidence };
                flaggedAccount.status = 'pending';
                flaggedAccount.flaggedAt = new Date();
            } else {
                // Create new flagged account
                flaggedAccount = new FlaggedAccount({
                    userId,
                    flagReason: flagData.reason,
                    flaggedBy: flagData.flaggedBy || userId, // System flagging
                    severity: flagData.severity,
                    description: flagData.description,
                    evidence: flagData.evidence || {}
                });
            }

            await flaggedAccount.save();

            // Log the flagging event
            await this.logSecurityEvent({
                userId,
                eventType: 'account_flagged',
                severity: flagData.severity,
                description: `Account flagged for: ${flagData.reason}`,
                metadata: {
                    flagReason: flagData.reason,
                    flaggedAccountId: flaggedAccount._id
                }
            });

            console.log(`🚩 Account flagged: ${userId} for ${flagData.reason}`);
            return flaggedAccount;
        } catch (error) {
            console.error('❌ Error flagging account:', error);
            throw error;
        }
    }

    // Parse server logs for anomalies (CS2 specific)
    static async parseServerLogs(logData) {
        try {
            const anomalies = [];

            // Basic log parsing for CS2 server logs
            if (logData.gameType === 'cs2' && logData.logContent) {
                const lines = logData.logContent.split('\n');

                for (const line of lines) {
                    // Check for suspicious kill patterns
                    if (line.includes('killed') && line.includes('headshot')) {
                        const headshotMatches = line.match(/headshot/g);
                        if (headshotMatches && headshotMatches.length > 5) {
                            anomalies.push({
                                type: 'excessive_headshots',
                                description: 'Excessive headshots in short time period',
                                severity: 'medium',
                                logLine: line
                            });
                        }
                    }

                    // Check for impossible movement speeds
                    if (line.includes('velocity') && line.includes('exceeded')) {
                        anomalies.push({
                            type: 'impossible_movement',
                            description: 'Player movement speed exceeded normal limits',
                            severity: 'high',
                            logLine: line
                        });
                    }

                    // Check for wallhack indicators
                    if (line.includes('shot_through_wall') || line.includes('prefire')) {
                        anomalies.push({
                            type: 'wallhack_indicator',
                            description: 'Possible wallhack usage detected',
                            severity: 'high',
                            logLine: line
                        });
                    }
                }
            }

            // Log server log analysis
            if (anomalies.length > 0) {
                await this.logSecurityEvent({
                    userId: logData.userId,
                    eventType: 'server_log_anomaly',
                    severity: anomalies.some(a => a.severity === 'high') ? 'high' : 'medium',
                    description: `Server log anomalies detected: ${anomalies.map(a => a.type).join(', ')}`,
                    metadata: {
                        matchId: logData.matchId,
                        gameType: logData.gameType,
                        anomalies
                    }
                });
            }

            return {
                hasAnomalies: anomalies.length > 0,
                anomalies,
                riskLevel: this.calculateRiskLevel(anomalies)
            };
        } catch (error) {
            console.error('❌ Error parsing server logs:', error);
            throw error;
        }
    }

    // Get security summary for admin dashboard
    static async getSecuritySummary() {
        try {
            const [
                totalSecurityLogs,
                pendingReviews,
                flaggedAccounts,
                criticalEvents,
                recentEvents
            ] = await Promise.all([
                SecurityLog.countDocuments(),
                SecurityLog.countDocuments({ status: 'pending' }),
                FlaggedAccount.countDocuments({ isResolved: false }),
                SecurityLog.countDocuments({ severity: 'critical', status: 'pending' }),
                SecurityLog.find({ status: 'pending' })
                    .sort({ createdAt: -1 })
                    .limit(10)
                    .populate('userId', 'username email')
            ]);

            return {
                totalSecurityLogs,
                pendingReviews,
                flaggedAccounts,
                criticalEvents,
                recentEvents
            };
        } catch (error) {
            console.error('❌ Error getting security summary:', error);
            throw error;
        }
    }

    // Calculate risk level based on flags/anomalies
    static calculateRiskLevel(flags) {
        if (!flags || flags.length === 0) return 'low';

        const highSeverityCount = flags.filter(f => f.severity === 'high').length;
        const mediumSeverityCount = flags.filter(f => f.severity === 'medium').length;

        if (highSeverityCount >= 2) return 'critical';
        if (highSeverityCount >= 1 || mediumSeverityCount >= 3) return 'high';
        if (mediumSeverityCount >= 1) return 'medium';

        return 'low';
    }

    // Get recent activity for a user
    static async getRecentActivity(userId, eventType, minutesBack = 5) {
        try {
            const startTime = new Date(Date.now() - minutesBack * 60 * 1000);

            const recentActivity = await SecurityLog.find({
                userId,
                eventType,
                createdAt: { $gte: startTime }
            }).sort({ createdAt: -1 });

            return recentActivity;
        } catch (error) {
            console.error('❌ Error getting recent activity:', error);
            return [];
        }
    }

    // Escalate security event
    static async escalateSecurityEvent(securityLogId) {
        try {
            const securityLog = await SecurityLog.findById(securityLogId);
            if (!securityLog) return;

            // Mark as high priority and notify admins
            securityLog.severity = 'critical';
            await securityLog.save();

            // TODO: Send notification to admin users
            console.log(`🚨 Security event escalated: ${securityLog.eventType} for user ${securityLog.userId}`);
        } catch (error) {
            console.error('❌ Error escalating security event:', error);
        }
    }

    // Ban user account
    static async banUser(userId, banData) {
        try {
            const user = await User.findById(userId);
            if (!user) throw new Error('User not found');

            // Update user status
            user.isActive = false;
            user.banReason = banData.reason;
            user.bannedAt = new Date();
            user.banExpiresAt = banData.banType === 'permanent' ? null : banData.expiresAt;
            await user.save();

            // Update flagged account if exists
            const flaggedAccount = await FlaggedAccount.findOne({ userId });
            if (flaggedAccount) {
                flaggedAccount.currentRestrictions.isBanned = true;
                flaggedAccount.currentRestrictions.banType = banData.banType;
                flaggedAccount.currentRestrictions.banExpiresAt = banData.expiresAt;
                flaggedAccount.status = 'resolved';
                flaggedAccount.isResolved = true;
                flaggedAccount.resolvedAt = new Date();
                flaggedAccount.resolvedBy = banData.bannedBy;
                flaggedAccount.resolutionNotes = banData.reason;
                await flaggedAccount.save();
            }

            // Log the ban
            await this.logSecurityEvent({
                userId,
                eventType: 'account_banned',
                severity: 'critical',
                description: `Account banned: ${banData.reason}`,
                metadata: {
                    banType: banData.banType,
                    bannedBy: banData.bannedBy,
                    expiresAt: banData.expiresAt
                }
            });

            console.log(`🔨 User banned: ${userId} - ${banData.reason}`);
            return { success: true, message: 'User banned successfully' };
        } catch (error) {
            console.error('❌ Error banning user:', error);
            throw error;
        }
    }
}

module.exports = SecurityService;