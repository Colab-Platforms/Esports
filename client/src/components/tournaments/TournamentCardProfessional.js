import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { motion } from "framer-motion";
import { createPortal } from "react-dom";
import CountdownTimer from "../common/CountdownTimer";
import GameIcon from "../common/GameIcon";
import SteamLinkingModal from "./SteamLinkingModal";
import { selectAuth } from "../../store/slices/authSlice";
import notificationService from "../../services/notificationService";
import { startSteamConnect } from "../../utils/apiConfig";


const FALLBACK_BANNERS = {
  cs2: "https://gameplayscassi.com.br/wp-content/smush-webp/2023/03/Rumores-indicam-que-a-beta-do-Counter-Strike-2-pode-ser-lancada-em-1o-de-abril..jpg.webp",
  freefire: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/generated-image-1775282348379.webp?v=1775290118",
  bgmi: "https://cdn.shopify.com/s/files/1/0636/5226/6115/files/bgmi.jpg?v=1768032058",
};

// Stable per-tournament number so tournaments without their own banner don't all look identical.
const hashString = (value = "") => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

const getFallbackBanner = (tournament, gameType) => {
  const hash = hashString(String(tournament._id || tournament.name || ""));
  const hue = hash % 360;
  const key = gameType === "ff" ? "freefire" : gameType;
  return {
    image: FALLBACK_BANNERS[key] || FALLBACK_BANNERS.bgmi,
    tint: `linear-gradient(135deg, hsl(${hue}, 65%, 28%) 0%, hsl(${(hue + 50) % 360}, 55%, 12%) 100%)`,
    position: `${20 + (hash % 61)}% ${20 + ((hash >> 8) % 61)}%`,
  };
};

const TournamentCardProfessional = ({
  tournament,
  getModeIcon,
  getStatusColor,
  formatDate,
  showTimer = true,
  gameType = "bgmi",
  hideBottomInfo = false,
}) => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useSelector(selectAuth);
  const [showSteamModal, setShowSteamModal] = useState(false);

  const handleSteamLink = React.useCallback(() => {
    if (!user) {
      notificationService.showCustomNotification(
        "error",
        "Error",
        "Unable to get user ID"
      );
      return;
    }

    setShowSteamModal(false);

    startSteamConnect(`/tournaments/${tournament._id}`).catch(() => {
      notificationService.showCustomNotification(
        "error",
        "Error",
        "Failed to start Steam connection. Please try again."
      );
    });
  }, [user, tournament._id]);

  const handleJoinTournament = React.useCallback(async () => {
    if (!isAuthenticated) {
      navigate("/login");
      return;
    }

    // CS2 Tournament - Direct join with Steam check
    if (tournament?.gameType === "cs2") {
      try {
        // Check if Steam is connected
        const steamId = user?.gameIds?.steam || user?.steamProfile?.steamId;
        const isSteamConnected = user?.steamProfile?.isConnected;

        console.log("🎮 CS2 Direct Join - Steam Check:", {
          steamId,
          isSteamConnected,
          user,
        });

        // If Steam not connected, show Steam linking modal
        if (!steamId || !isSteamConnected) {
          console.log("⚠️ Steam not connected - showing Steam modal");
          setShowSteamModal(true);
          return;
        }

        // Steam connected - directly join tournament
        console.log("✅ Steam connected - joining tournament directly");

        const token = localStorage.getItem("token");
        const API_BASE_URL = process.env.REACT_APP_API_URL || "";

        const response = await fetch(
          `${API_BASE_URL}/api/tournaments/${tournament._id}/join`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              gameId: steamId,
              teamName: "",
            }),
          },
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error?.message || "Failed to join tournament");
        }

        console.log("✅ Successfully joined CS2 tournament:", data);

        // Trigger cache invalidation for homepage
        window.dispatchEvent(
          new CustomEvent("tournamentJoined", {
            detail: {
              tournamentId: tournament._id,
              tournamentName: tournament.name,
            },
          }),
        );

        // Update localStorage timestamp for cache invalidation
        localStorage.setItem("last_tournament_update", Date.now().toString());

        // Show success notification
        notificationService.showCustomNotification(
          "success",
          "Tournament Joined!",
          `Successfully joined ${tournament.name}. Launching CS2...`,
        );

        // Launch CS2 directly - Steam will handle installation if needed
        if (tournament.roomDetails?.cs2?.connectCommand) {
          window.location.href = tournament.roomDetails.cs2.connectCommand;
        }
      } catch (error) {
        console.error("❌ Failed to join CS2 tournament:", error);
        notificationService.showCustomNotification(
          "error",
          "Join Failed",
          `Failed to join tournament: ${error.message}`,
        );
      }
      return;
    }

    // For non-CS2 tournaments, navigate to details page
    navigate(`/tournaments/${tournament._id}`);
  }, [isAuthenticated, tournament, user, navigate]);

  const fallbackBanner = getFallbackBanner(tournament, gameType);

  const maxSlots = Number(tournament.maxParticipants) || 0;
  const filledSlots = Math.min(Number(tournament.currentParticipants) || 0, maxSlots);
  const slotsPercent = maxSlots > 0 ? Math.round((filledSlots / maxSlots) * 100) : 0;
  const slotsFull = maxSlots > 0 && filledSlots >= maxSlots;

  const now = Date.now();
  let countdown = null;
  if (
    tournament.status === "registration_open" &&
    tournament.registrationDeadline &&
    new Date(tournament.registrationDeadline).getTime() > now
  ) {
    countdown = { label: "REGISTRATION CLOSES IN", target: tournament.registrationDeadline };
  } else if (
    showTimer &&
    tournament.status !== "completed" &&
    tournament.startDate &&
    new Date(tournament.startDate).getTime() > now
  ) {
    countdown = { label: "STARTS IN", target: tournament.startDate };
  }

  return (

    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative w-full aspect-[4/5] overflow-hidden border border-gaming-gold/70 hover:border-gaming-gold transition-all duration-300 group bg-gradient-to-br from-gaming-charcoal via-gaming-dark to-gaming-darker shadow-xl hover:shadow-gaming-gold/40"
      style={{
        clipPath:
          "polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px)",
      }}
    >
      {/* Background Image - the tournament's own banner, else a per-tournament tinted fallback */}
      <div className="absolute inset-0">
        {tournament.bannerImage ? (
          <img
            src={tournament.bannerImage}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: fallbackBanner.tint }} />
            <img
              src={fallbackBanner.image}
              alt=""
              style={{ objectPosition: fallbackBanner.position }}
              className="w-full h-full object-cover opacity-40 mix-blend-luminosity group-hover:scale-105 transition-transform duration-500"
            />
          </>
        )}
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/90" />
      </div>

      {/* Content Container */}
      <div className="absolute inset-0 flex flex-col justify-between p-5">
        <div>
          {/* Game + status */}
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
            <GameIcon gameType={gameType} size="sm" />
            <div
              className={`px-2.5 py-1 rounded-full text-base font-display font-bold ${getStatusColor(tournament.status)}`}
            >
              {tournament.status === "completed"
                ? "FINISHED"
                : tournament.status.replace(/_/g, " ").toUpperCase()}
            </div>
          </div>

          {/* Tournament name - first thing on every card */}
          <h3 className="text-white font-display text-xl sm:text-2xl font-bold leading-tight line-clamp-2 drop-shadow-lg tracking-wide">
            {tournament.name}
          </h3>
        </div>

        {/* Bottom Section - Info Bar */}
        <div className="space-y-2.5">
          {!hideBottomInfo && (
            <>
              {/* Prize Pool & Entry Fee Row */}
              <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 text-base">
                {gameType !== "cs2" && (
                  <div className="flex items-center space-x-1.5">
                    <span className="text-gaming-gold font-display font-bold">
                      PRIZE:
                    </span>
                    <span className="text-white font-display font-bold">
                      ₹{(tournament.prizePool / 1000).toFixed(0)}K
                    </span>
                  </div>
                )}
                <div className="flex items-center space-x-1.5">
                  <span className="text-gaming-gold font-display font-bold">
                    ENTRY:
                  </span>
                  <span className="text-white font-display font-bold">
                    ₹{tournament.entryFee}
                  </span>
                </div>
              </div>

              {/* Slots filled + progress bar */}
              {gameType !== "cs2" && maxSlots > 0 && (
                <div>
                  <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-1 text-base mb-1">
                    <span className="text-white font-display font-bold">
                      {filledSlots}/{maxSlots} slots
                    </span>
                    <span className="text-gray-300 font-display text-base">
                      {slotsFull ? "FULL" : `${maxSlots - filledSlots} left`}
                    </span>
                  </div>
                  <div
                    className="h-2 w-full rounded-full bg-white/15 overflow-hidden"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={maxSlots}
                    aria-valuenow={filledSlots}
                    aria-label="Slots filled"
                  >
                    <div
                      className={`h-full rounded-full ${slotsFull ? "bg-red-500" : "bg-gaming-gold"}`}
                      style={{ width: `${slotsPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Countdown: registration deadline while open, otherwise time to start */}
              {countdown && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-base">
                  <span className="text-gaming-gold font-display font-bold text-base">
                    {countdown.label}
                  </span>
                  <CountdownTimer
                    targetDate={countdown.target}
                    format="compact"
                    size="md"
                    showLabels={false}
                    className="text-white"
                  />
                </div>
              )}

              {/* Divider Line */}
              {gameType !== "cs2" && (
                <div className="h-px bg-gradient-to-r from-gaming-gold/20 via-gaming-gold/40 to-gaming-gold/20" />
              )}

              {/* Dates Row (with year) */}
              {gameType !== "cs2" && (
                <div className="flex flex-wrap justify-between items-center gap-x-3 gap-y-1">
                  <div>
                    <div className="text-gaming-gold font-display font-bold text-base">
                      REG DEADLINE
                    </div>
                    <div className="text-white font-display text-base">
                      {formatDate(tournament.registrationDeadline)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-gaming-gold font-display font-bold text-base">
                      STARTS
                    </div>
                    <div className="text-white font-display text-base">
                      {formatDate(tournament.startDate)}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Buttons Section */}
          {gameType === "cs2" ? (
            <div className="space-y-2">
              {/* JOIN SERVER Button */}
              <button
                onClick={() => {
                  if (!isAuthenticated) {
                    navigate("/login");
                  } else {
                    handleJoinTournament();
                  }
                }}
                disabled={
                  tournament?.status !== "active"
                }
                className={`w-full py-2.5 px-3 bg-gaming-gold hover:bg-yellow-500 text-black font-display font-bold text-base rounded-lg transition-all duration-300 shadow-lg hover:shadow-gaming-gold/40 ${tournament?.status !== "active"
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer"
                  }`}
              >
                {!isAuthenticated
                  ? "LOGIN TO JOIN"
                  : tournament?.status === "active"
                    ? "JOIN SERVER"
                    : "SERVER INACTIVE"}
              </button>

              {/* VIEW DETAILS Button */}
              <button
                onClick={() => navigate(`/tournaments/${tournament._id}`)}
                className="w-full py-2 px-3 bg-white/10 backdrop-blur-md border border-white/20 hover:border-gaming-gold/60 hover:bg-white/20 text-white font-display font-bold text-base rounded-lg transition-all duration-300 shadow-lg hover:shadow-gaming-gold/40"
              >
                VIEW DETAILS →
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate(`/tournaments/${tournament._id}`)}
              className="w-full py-2 px-3 mt-2 bg-white/10 backdrop-blur-md border border-white/20 hover:border-gaming-gold/60 hover:bg-white/20 text-white font-display font-bold text-base rounded-lg transition-all duration-300 shadow-lg hover:shadow-gaming-gold/40"
            >
              VIEW DETAILS →
            </button>
          )}
        </div>
      </div>

      {/* Steam Linking Modal - Rendered outside card using Portal */}
      {showSteamModal && createPortal(
        <SteamLinkingModal
          isOpen={showSteamModal}
          onClose={() => setShowSteamModal(false)}
          onConfirm={handleSteamLink}
          tournamentName={tournament?.name || 'CS2 Tournament'}
        />,
        document.body
      )}
    </motion.div>
  );
};

export default TournamentCardProfessional;
