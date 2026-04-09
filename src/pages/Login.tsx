import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfile, saveUserProfile } from "@/lib/storage";
import {
  SESSION_SUBJECT_KEY,
  initializeNewSubject,
  loginWithSubjectId,
} from "@/lib/subject-auth";

type Phase = "menu" | "login" | "initializing" | "briefing" | "name-entry";

const Login = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("menu");
  const [inputId, setInputId] = useState("");
  const [newSubjectId, setNewSubjectId] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!inputId.trim()) return;
    setLoading(true);
    setError("");
    const { error } = await loginWithSubjectId(inputId);
    if (error) {
      setError(error);
      setLoading(false);
    } else {
      navigate("/");
    }
  };

  const handleInitialize = async () => {
    setPhase("initializing");
    setError("");
    const { subjectId, error } = await initializeNewSubject();
    if (error) {
      setError(error);
      setPhase("menu");
    } else {
      setNewSubjectId(subjectId);
      setPhase("briefing");
    }
  };

  const handleBriefingConfirm = () => {
    setPhase("name-entry");
  };

  const handleNameSubmit = () => {
    if (!fullName.trim()) return;
    // Save fullName to the profile
    const profile = getUserProfile();
    profile.fullName = fullName.trim();
    saveUserProfile(profile);

    if (newSubjectId) {
      localStorage.setItem(SESSION_SUBJECT_KEY, newSubjectId);
    }
    navigate("/");
  };

  return (
    <div className="min-h-dvh bg-background flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-xl font-mono">
        {/* Header */}
        <div className="border border-primary/30 p-3 sm:p-4 mb-5 sm:mb-6 overflow-x-auto">
          <pre className="text-primary text-[10px] sm:text-xs md:text-sm leading-tight text-center whitespace-pre min-w-[280px]">
{`╔═══════════════════════════════╗
║      P R O T O C O L          ║
║   SUBJECT ACCESS TERMINAL     ║
╚═══════════════════════════════╝`}
          </pre>
        </div>

        {/* Menu Phase */}
        {phase === "menu" && (
          <div className="space-y-3 sm:space-y-4">
            <p className="text-muted-foreground text-xs sm:text-sm text-center mb-4 sm:mb-6">
              {">"} SELECT ACCESS MODE_
            </p>
            <button
              onClick={() => setPhase("login")}
              className="w-full border border-primary/40 bg-primary/5 hover:bg-primary/15 text-primary py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm tracking-wide sm:tracking-wider transition-colors text-left"
            >
              [1] RETURNING SUBJECT — ENTER ID
            </button>
            <button
              onClick={handleInitialize}
              className="w-full border border-accent/40 bg-accent/5 hover:bg-accent/15 text-accent-foreground py-2.5 sm:py-3 px-3 sm:px-4 text-xs sm:text-sm tracking-wide sm:tracking-wider transition-colors text-left"
            >
              [2] INITIALIZE NEW SUBJECT
            </button>
          </div>
        )}

        {/* Login Phase */}
        {phase === "login" && (
          <div className="space-y-3 sm:space-y-4">
            <p className="text-muted-foreground text-xs sm:text-sm">
              {">"} ENTER SUBJECT IDENTIFIER_
            </p>
            <div className="flex flex-col sm:flex-row gap-1.5 sm:gap-2">
              <span className="text-primary text-sm sm:text-lg py-1 sm:py-2">SUBJECT-</span>
              <input
                type="text"
                value={inputId}
                onChange={(e) => setInputId(e.target.value.toUpperCase().slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="______"
                maxLength={6}
                autoFocus
                className="flex-1 bg-transparent border-b-2 border-primary/50 text-primary text-base sm:text-lg font-mono tracking-[0.2em] sm:tracking-[0.3em] py-2 px-1 focus:outline-none focus:border-primary placeholder:text-primary/20 uppercase min-w-0"
              />
            </div>

            {error && (
              <p className="text-destructive text-xs animate-pulse">
                ⚠ {error}
              </p>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1 sm:pt-2">
              <button
                onClick={handleLogin}
                disabled={loading || inputId.length < 4}
                className="flex-1 border border-primary bg-primary/10 hover:bg-primary/25 text-primary py-2.5 text-xs sm:text-sm tracking-wide sm:tracking-wider transition-colors disabled:opacity-30"
              >
                {loading ? "AUTHENTICATING..." : "ACCESS SYSTEM →"}
              </button>
              <button
                onClick={() => { setPhase("menu"); setError(""); setInputId(""); }}
                className="border border-muted-foreground/30 text-muted-foreground py-2.5 px-4 text-xs sm:text-sm hover:bg-muted/20 transition-colors w-full sm:w-auto"
              >
                BACK
              </button>
            </div>
          </div>
        )}

        {/* Initializing Phase */}
        {phase === "initializing" && (
          <div className="space-y-3 text-center">
            <p className="text-primary text-sm animate-pulse">
              GENERATING SUBJECT IDENTITY...
            </p>
            <div className="text-primary/40 text-xs">
              ████████████░░░░ 78%
            </div>
            {error && (
              <p className="text-destructive text-xs">⚠ {error}</p>
            )}
          </div>
        )}

        {/* Briefing Phase - Shows new subject their ID */}
        {phase === "briefing" && (
          <div className="space-y-4 sm:space-y-5">
            <div className="border border-destructive/50 bg-destructive/5 p-3 sm:p-4">
              <p className="text-destructive text-xs font-bold tracking-wider mb-2">
                ⚠ CLASSIFIED BRIEFING — READ CAREFULLY
              </p>
              <div className="text-muted-foreground text-xs leading-relaxed space-y-2">
                <p>
                  You have been assigned a unique Subject Identifier.
                  This ID is your <span className="text-primary font-bold">ONLY</span> access key to the system.
                </p>
                <p>
                  There is no password recovery. There is no support desk.
                  If you lose this ID, your progress is <span className="text-destructive">permanently lost</span>.
                </p>
              </div>
            </div>

            <div className="border border-primary bg-primary/5 p-4 sm:p-6 text-center">
              <p className="text-muted-foreground text-xs mb-2">YOUR SUBJECT IDENTIFIER</p>
              <p className="text-primary text-2xl sm:text-4xl font-bold tracking-[0.22em] sm:tracking-[0.4em] break-all">
                {newSubjectId}
              </p>
              <p className="text-muted-foreground text-xs mt-2">
                FULL DESIGNATION: SUBJECT-{newSubjectId}
              </p>
            </div>

            <div className="border border-muted-foreground/30 bg-muted/5 p-3">
              <p className="text-muted-foreground text-xs leading-relaxed">
                {">"} Write it down. Screenshot it. Memorize it.<br />
                {">"} Use this ID to log in from any device.<br />
                {">"} This is your identity in the system.
              </p>
            </div>

            <div className="border border-muted-foreground/20 bg-muted/5 p-3">
              <p className="text-muted-foreground text-[10px] leading-relaxed uppercase tracking-wider">
                DISCLAIMER: By proceeding you acknowledge that SysLVLUP is a
                self-improvement protocol. All data is stored under your Subject ID.
                You are solely responsible for maintaining access to your identifier.
                The system bears no liability for lost progress due to forgotten IDs.
              </p>
            </div>

            <button
              onClick={handleBriefingConfirm}
              className="w-full border border-primary bg-primary/10 hover:bg-primary/25 text-primary py-3 text-xs sm:text-sm tracking-wide sm:tracking-wider transition-colors"
            >
              I HAVE MEMORIZED MY ID — ENTER SYSTEM →
            </button>
          </div>
        )}

        {/* Name Entry Phase */}
        {phase === "name-entry" && (
          <div className="space-y-4 sm:space-y-5">
            <div className="border border-primary/50 bg-primary/5 p-4 sm:p-6 text-center">
              <p className="text-muted-foreground text-xs mb-1">SUBJECT IDENTIFIER CONFIRMED</p>
              <p className="text-primary text-xl sm:text-2xl font-bold tracking-[0.2em]">{newSubjectId}</p>
            </div>

            <div className="border border-accent/40 bg-accent/5 p-3 sm:p-4">
              <p className="text-accent-foreground text-xs font-bold tracking-wider mb-2">
                IDENTITY REGISTRATION
              </p>
              <p className="text-muted-foreground text-xs leading-relaxed mb-4">
                Enter your full name. This will be displayed on the <span className="text-primary font-bold">global leaderboard</span>.
                Your Subject ID remains classified — only your name will be publicly visible.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-muted-foreground tracking-wider uppercase block mb-1">FULL NAME</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
                    placeholder="Enter your full name..."
                    autoFocus
                    className="w-full bg-transparent border-b-2 border-primary/50 text-primary text-sm sm:text-base font-mono py-2 px-1 focus:outline-none focus:border-primary placeholder:text-primary/20"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleNameSubmit}
              disabled={!fullName.trim()}
              className="w-full border border-primary bg-primary/10 hover:bg-primary/25 text-primary py-3 text-xs sm:text-sm tracking-wide sm:tracking-wider transition-colors disabled:opacity-30"
            >
              CONFIRM IDENTITY — ENTER SYSTEM →
            </button>
          </div>

        {/* Footer */}
        <div className="mt-6 sm:mt-8 text-center">
          <p className="text-muted-foreground/30 text-[10px] tracking-widest">
            SYSLVLUP v2.0 — SECURE ACCESS TERMINAL
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
